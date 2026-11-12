"""Gemini wrapper: one call = one model turn. The agent loop lives in agent.py.

Keeping the SDK behind this small interface means the loop can be unit-tested with a fake LLM,
and swapping providers later only touches this file.
"""

import asyncio
from dataclasses import dataclass, field
from typing import Any

from google import genai
from google.genai import errors, types


@dataclass
class FunctionCall:
    name: str
    args: dict
    id: str | None = None


@dataclass
class LLMTurn:
    content: Any  # opaque message to append to the history
    function_calls: list[FunctionCall] = field(default_factory=list)
    text: str = ""
    input_tokens: int = 0
    output_tokens: int = 0  # includes "thinking" tokens, which are billed as output


class GeminiLLM:
    def __init__(self, api_key: str, model: str):
        self.client = genai.Client(api_key=api_key)
        self.model = model

    @staticmethod
    def user_message(text: str) -> types.Content:
        return types.Content(role="user", parts=[types.Part.from_text(text=text)])

    @staticmethod
    def tool_results(results: list[tuple[FunctionCall, dict]]) -> types.Content:
        parts = [
            types.Part(function_response=types.FunctionResponse(id=call.id, name=call.name, response=result))
            for call, result in results
        ]
        return types.Content(role="user", parts=parts)

    async def generate(self, history: list, system: str, tools: list[dict], force_tool: str | None = None) -> LLMTurn:
        tool_config = None
        if force_tool:
            tool_config = types.ToolConfig(
                function_calling_config=types.FunctionCallingConfig(mode="ANY", allowed_function_names=[force_tool])
            )
        config = types.GenerateContentConfig(
            system_instruction=system,
            tools=[types.Tool(function_declarations=[types.FunctionDeclaration(**t) for t in tools])],
            tool_config=tool_config,
            # We run tools ourselves so we can stream, log and validate each call.
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            temperature=0.2,
        )

        resp = None
        for attempt in range(5):
            try:
                resp = await self.client.aio.models.generate_content(model=self.model, contents=history, config=config)
                break
            except errors.APIError as e:
                # 429 = free-tier rate limit, 5xx = overloaded. Back off and retry; anything else is fatal.
                if e.code in (429, 500, 503, 504) and attempt < 4:
                    await asyncio.sleep(min(60, 4 * 2**attempt))
                    continue
                raise

        candidate = resp.candidates[0] if resp and resp.candidates else None
        content = candidate.content if candidate and candidate.content else types.Content(role="model", parts=[])
        calls, texts = [], []
        for part in content.parts or []:
            if part.function_call:
                calls.append(FunctionCall(part.function_call.name, dict(part.function_call.args or {}), part.function_call.id))
            elif part.text and not part.thought:
                texts.append(part.text)

        usage = resp.usage_metadata if resp else None
        return LLMTurn(
            content=content,
            function_calls=calls,
            text="\n".join(texts).strip(),
            input_tokens=(usage.prompt_token_count or 0) if usage else 0,
            output_tokens=((usage.candidates_token_count or 0) + (usage.thoughts_token_count or 0)) if usage else 0,
        )
