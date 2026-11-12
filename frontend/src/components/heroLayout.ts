/** The "repo city": folders as blocks on a 10x10 grid. Shared by the SVG and 3D hero. */
export type Tone = "paper" | "cobalt" | "marker" | "sand";

export interface Block {
  name: string;
  x: number; // grid position (x grows to the right-back, y to the left-back)
  y: number;
  w: number;
  d: number;
  h: number;
  tone: Tone;
}

export const BLOCKS: Block[] = [
  { name: "README.md", x: 0, y: 0, w: 2, d: 2, h: 0.8, tone: "paper" },
  { name: "CONTRIBUTING", x: 3, y: 0, w: 2, d: 2, h: 1.3, tone: "paper" },
  { name: ".github", x: 8, y: 0, w: 2, d: 2, h: 1, tone: "sand" },
  { name: "docs/", x: 0, y: 3, w: 2, d: 3, h: 2, tone: "sand" },
  { name: "src/", x: 3, y: 3, w: 4, d: 4, h: 2.4, tone: "cobalt" },
  { name: "tests/", x: 8, y: 3, w: 2, d: 3, h: 2.4, tone: "sand" },
  { name: "pyproject", x: 0, y: 7, w: 2, d: 2, h: 1.2, tone: "paper" },
  { name: "examples/", x: 3, y: 8, w: 3, d: 2, h: 1.5, tone: "sand" },
  { name: "issue #42", x: 8, y: 7, w: 2, d: 2, h: 2.8, tone: "marker" },
];

/** The route a newcomer walks: README -> CONTRIBUTING -> setup -> first issue. */
export const ROUTE = [
  { block: "README.md", label: "01 README" },
  { block: "CONTRIBUTING", label: "02 CONTRIBUTING" },
  { block: "pyproject", label: "03 setup" },
  { block: "issue #42", label: "04 first issue" },
];

export function blockTop(name: string) {
  const b = BLOCKS.find((x) => x.name === name)!;
  return { x: b.x + b.w / 2, y: b.y + b.d / 2, z: b.h };
}
