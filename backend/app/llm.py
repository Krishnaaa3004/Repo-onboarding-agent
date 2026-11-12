"""Gemini wrapper: one call = one model turn. The agent loop lives in agent.py.

Keeping the SDK behind this small interface means the loop can be unit-tested with a fake LLM,
and swapping providers later only touches this file.
"""

import asyncio
import time
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
    def __init__(self, api_key: str, model: str, fallback_models: list[str] | None = None):
        # attempts=1 turns off the SDK's own retries; _call_with_retries is the single retry layer,
        # so timing is predictable and we can fall back to another model quickly.
        self.client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(retry_options=types.HttpRetryOptions(attempts=1), timeout=60_000),
        )
        chain = list(dict.fromkeys([model, *(fallback_models or [])]))
        # Skip models that failed recently in this process; if all are cooling down, try them anyway.
        healthy = [m for m in chain if GeminiLLM._cooldown_until.get(m, 0) < time.time()] or chain
        self.model = healthy[0]  # the model currently in use (changes if we fall back)
        self.fallbacks = healthy[1:]

    # Shared across instances: model name -> unix time until which we avoid it.
    _cooldown_until: dict[str, float] = {}

    @classmethod
    def _cool_down(cls, model: str, error: errors.APIError) -> None:
        daily_quota = error.code == 429 and "PerDay" in str(error)
        cls._cooldown_until[model] = time.time() + (3600 if daily_quota or error.code == 404 else 300)

    async def _call_with_retries(self, model: str, history: list, config: types.GenerateContentConfig, attempts: int = 2):
        for attempt in range(attempts):
            try:
                return await self.client.aio.models.generate_content(model=model, contents=history, config=config)
            except errors.APIError as e:
                # Only a per-minute rate limit is worth waiting for. Overload (5xx) and daily quota
                # fail over to the next model straight away, since waiting is slow and rarely helps.
                if e.code == 429 and "PerDay" not in str(e) and attempt < attempts - 1:
                    await asyncio.sleep(10)
                    continue
                raise

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
            # temperature left at the default: Google recommends 1.0 for Gemini 3 models
        )

        resp = None
        while resp is None:
            try:
                resp = await self._call_with_retries(self.model, history, config)
            except errors.APIError as e:
                # Model overloaded, out of quota (quotas are per model) or retired (404):
                # move to the next fallback for the rest of this run.
                if e.code in (404, 429, 500, 503, 504):
                    self._cool_down(self.model, e)
                    if self.fallbacks:
                        self.model = self.fallbacks.pop(0)
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
