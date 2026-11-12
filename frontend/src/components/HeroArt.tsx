import { motion } from "framer-motion";
import { BLOCKS, ROUTE, blockTop, type Tone } from "./heroLayout";

/* Isometric projection: 30-degree axes, U pixels per grid unit. */
const U = 26;
const C = Math.cos(Math.PI / 6);
const S = 0.5;
const OX = 280;
const OY = 110;
const iso = (x: number, y: number, z: number) => [OX + (x - y) * C * U, OY + (x + y) * S * U - z * U] as const;
const pts = (p: (readonly [number, number])[]) => p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");

const FACES: Record<Tone, [string, string, string]> = {
  // top, front-left, front-right
  paper: ["#fdfbf7", "#e9e1d2", "#d9cfbc"],
  sand: ["#f1ebdf", "#dcd2bf", "#cbbfa8"],
  cobalt: ["#dfe5fa", "#9fb0ea", "#7c92e0"],
  marker: ["#f8e7a8", "#ecd07a", "#ddbd5c"],
};

/**
 * Static isometric "repo city" with a route drawn through it.
 * Used on mobile, with reduced motion, and while the 3D scene loads.
 */
export function HeroArt({ animate = true }: { animate?: boolean }) {
  const sorted = [...BLOCKS].sort((a, b) => a.x + a.y - (b.x + b.y));
  const route = ROUTE.map((r) => iso(blockTop(r.block).x, blockTop(r.block).y, blockTop(r.block).z));
  const d = route.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox="0 0 560 470" className="hero-art" role="img"
      aria-label="An isometric map of a repository: folders drawn as blocks, with a route from README to CONTRIBUTING to setup to a first issue.">
      {/* ground grid */}
      <g stroke="var(--grid-major)" strokeWidth="1">
        {Array.from({ length: 11 }, (_, i) => (
          <g key={i}>
            <line x1={iso(i, 0, 0)[0]} y1={iso(i, 0, 0)[1]} x2={iso(i, 10, 0)[0]} y2={iso(i, 10, 0)[1]} />
            <line x1={iso(0, i, 0)[0]} y1={iso(0, i, 0)[1]} x2={iso(10, i, 0)[0]} y2={iso(10, i, 0)[1]} />
          </g>
        ))}
      </g>

      {sorted.map((b, i) => {
        const [top, left, right] = FACES[b.tone];
        const { x, y, w, d: dep, h } = b;
        return (
          <motion.g key={b.name}
            initial={animate ? { opacity: 0, y: 24 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.07, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
            <polygon points={pts([iso(x, y + dep, 0), iso(x + w, y + dep, 0), iso(x + w, y + dep, h), iso(x, y + dep, h)])} fill={left} stroke="#17150f" strokeOpacity=".22" />
            <polygon points={pts([iso(x + w, y, 0), iso(x + w, y + dep, 0), iso(x + w, y + dep, h), iso(x + w, y, h)])} fill={right} stroke="#17150f" strokeOpacity=".22" />
            <polygon points={pts([iso(x, y, h), iso(x + w, y, h), iso(x + w, y + dep, h), iso(x, y + dep, h)])} fill={top} stroke="#17150f" strokeOpacity=".22" />
          </motion.g>
        );
      })}

      {/* route */}
      <motion.path d={d} fill="none" stroke="var(--cobalt)" strokeWidth="2.4" strokeDasharray="1 0"
        strokeLinecap="round" strokeLinejoin="round"
        initial={animate ? { pathLength: 0 } : false} animate={{ pathLength: 1 }}
        transition={{ delay: 0.9, duration: 1.6, ease: "easeInOut" }} />
      {route.map(([x, y], i) => (
        <motion.g key={i} initial={animate ? { opacity: 0, scale: 0.4 } : false} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1 + i * 0.4, duration: 0.4 }} style={{ transformOrigin: `${x}px ${y}px` }}>
          <circle cx={x} cy={y} r="9" fill="var(--paper)" stroke="var(--cobalt)" strokeWidth="2" />
          <text x={x} y={y + 3.5} textAnchor="middle" className="hero-art-num">{i + 1}</text>
          <text x={x + (i === 2 ? -14 : 14)} y={y - 12} textAnchor={i === 2 ? "end" : "start"} className="hero-art-label">
            {ROUTE[i].label.slice(3)}
          </text>
        </motion.g>
      ))}

      {/* cartographic details */}
      <g className="hero-art-meta">
        <text x="16" y="458">N 12.97° · E 77.59°</text>
        <g transform="translate(430 452)">
          <line x1="0" y1="0" x2="104" y2="0" stroke="var(--ink-3)" />
          {[0, 26, 52, 78, 104].map((t) => <line key={t} x1={t} y1="-4" x2={t} y2="0" stroke="var(--ink-3)" />)}
          <text x="0" y="-8">0</text>
          <text x="104" y="-8" textAnchor="end">1 repo</text>
        </g>
        <g transform="translate(520 34)">
          <circle r="14" fill="none" stroke="var(--ink-3)" />
          <path d="M0 -11 L4 2 L0 0 L-4 2 Z" fill="var(--cobalt)" />
          <text y="-20" textAnchor="middle">N</text>
        </g>
      </g>
    </svg>
  );
}
