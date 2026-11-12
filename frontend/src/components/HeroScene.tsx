import { Edges, Line } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BLOCKS, ROUTE, blockTop, type Block, type Tone } from "./heroLayout";

/*
 * 3D "repo city": folders as blocks that rise into place, with a route arcing through the files a
 * newcomer reads first. Lazy-loaded; rendering pauses when the hero is off-screen.
 */

const COLORS: Record<Tone, string> = {
  paper: "#fbf8f2",
  sand: "#eae2d3",
  cobalt: "#c9d3f6",
  marker: "#f2d878",
};

const ASSEMBLE_S = 1.6; // blocks rise over this long
const ROUTE_START_S = 1.1;
const ROUTE_S = 2.2;
const ease = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

// grid (x, y) on the floor -> world (X, Z), centred on the origin
const toWorld = (x: number, y: number, z: number) => new THREE.Vector3(x - 5, z, y - 5);

function BlockMesh({ b, index, start }: { b: Block; index: number; start: React.RefObject<number | null> }) {
  const ref = useRef<THREE.Group>(null);
  const delay = 0.1 + index * 0.09;
  useFrame(({ clock }) => {
    if (!ref.current || start.current === null) return;
    const t = ease((clock.elapsedTime - start.current - delay) / (ASSEMBLE_S * 0.6));
    ref.current.scale.y = Math.max(t, 0.001);
    ref.current.position.y = (1 - t) * 0.6;
  });
  const pos = toWorld(b.x + b.w / 2, b.y + b.d / 2, 0);
  return (
    <group ref={ref} position={[pos.x, 0, pos.z]} scale={[1, 0.001, 1]}>
      <mesh position={[0, b.h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[b.w - 0.08, b.h, b.d - 0.08]} />
        <meshLambertMaterial color={COLORS[b.tone]} />
        <Edges color="#17150f" transparent opacity={0.28} />
      </mesh>
    </group>
  );
}

function Route({ start }: { start: React.RefObject<number | null> }) {
  const curve = useMemo(() => {
    const tops = ROUTE.map((r) => blockTop(r.block));
    const pts: THREE.Vector3[] = [];
    tops.forEach((p, i) => {
      pts.push(toWorld(p.x, p.y, p.z + 0.12));
      const next = tops[i + 1];
      if (next) {
        // arc over whatever lies between two waypoints
        const lift = Math.max(p.z, next.z) + 1.3;
        pts.push(toWorld((p.x + next.x) / 2, (p.y + next.y) / 2, lift));
      }
    });
    return new THREE.CatmullRomCurve3(pts, false, "centripetal");
  }, []);
  const all = useMemo(() => curve.getPoints(140), [curve]);
  const [count, setCount] = useState(2);

  useFrame(({ clock }) => {
    if (start.current === null) return;
    const t = ease((clock.elapsedTime - start.current - ROUTE_START_S) / ROUTE_S);
    const n = Math.max(2, Math.round(t * all.length));
    if (n !== count) setCount(n);
  });

  return <Line points={all.slice(0, count)} color="#2443c4" lineWidth={3.2} depthTest={false} renderOrder={10} />;
}

type LabelRefs = React.RefObject<(HTMLSpanElement | null)[]>;

function Waypoints({ start, labels }: { start: React.RefObject<number | null>; labels: LabelRefs }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock, camera, size }) => {
    if (start.current === null) return;
    refs.current.forEach((g, i) => {
      if (!g) return;
      const s = ease((clock.elapsedTime - start.current! - ROUTE_START_S - (i / 3) * ROUTE_S) / 0.35);
      g.scale.setScalar(Math.max(s, 0.001));
      // project the waypoint to screen space and move its DOM label there
      const el = labels.current?.[i];
      if (el) {
        g.getWorldPosition(v).project(camera);
        const x = ((v.x + 1) / 2) * size.width;
        const y = ((1 - v.y) / 2) * size.height;
        el.style.transform = `translate(${x.toFixed(1)}px, ${(y - 16).toFixed(1)}px) translate(-50%, -100%)`;
        el.style.opacity = String(s);
      }
    });
  });
  return (
    <>
      {ROUTE.map((r, i) => {
        const p = blockTop(r.block);
        const v = toWorld(p.x, p.y, p.z + 0.12);
        return (
          <group key={r.block} position={v} ref={(g) => { refs.current[i] = g; }} scale={0.001}>
            <mesh>
              <sphereGeometry args={[0.2, 24, 16]} />
              <meshStandardMaterial color={i === 3 ? "#f2d878" : "#ffffff"} />
            </mesh>
            <mesh>
              <torusGeometry args={[0.22, 0.05, 10, 32]} />
              <meshStandardMaterial color="#2443c4" />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function Rig({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const on = (e: PointerEvent) => {
      pointer.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 };
    };
    window.addEventListener("pointermove", on, { passive: true });
    return () => window.removeEventListener("pointermove", on);
  }, []);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    // scroll turns the map a little; the mouse adds a gentle parallax tilt
    const scroll = Math.min(window.scrollY / 700, 1);
    const targetY = pointer.current.x * 0.12 + scroll * 0.45;
    const targetX = pointer.current.y * 0.05;
    g.rotation.y += (targetY - g.rotation.y) * 0.06;
    g.rotation.x += (targetX - g.rotation.x) * 0.06;
  });
  return <group ref={group}>{children}</group>;
}

function Scene({ labels }: { labels: LabelRefs }) {
  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    if (start.current === null) start.current = clock.elapsedTime;
  });
  return (
    <>
      <ambientLight intensity={1.15} />
      <hemisphereLight args={["#fffaf0", "#e8e0d1", 0.45]} />
      <directionalLight position={[-6, 14, -9]} intensity={1.1} castShadow
        shadow-mapSize={[1024, 1024]} shadow-camera-left={-9} shadow-camera-right={9}
        shadow-camera-top={9} shadow-camera-bottom={-9} shadow-bias={-0.0004} />
      <Rig>
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[14, 14]} />
          <shadowMaterial transparent opacity={0.13} />
        </mesh>
        <gridHelper args={[10, 10, "#9fb0ea", "#c9d3f6"]} position={[0, 0.001, 0]} />
        {BLOCKS.map((b, i) => <BlockMesh key={b.name} b={b} index={i} start={start} />)}
        <Route start={start} />
        <Waypoints start={start} labels={labels} />
      </Rig>
    </>
  );
}

export default function HeroScene() {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const labels = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className="hero-scene" role="img"
      aria-label="A 3D map of a repository: folders as blocks, with a route from README to CONTRIBUTING to setup to a first issue.">
      <Canvas
        orthographic
        flat
        shadows
        dpr={[1, 1.5]}
        frameloop={visible ? "always" : "never"}
        camera={{ position: [-14, 13, -14], zoom: 34, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        onCreated={({ camera }) => camera.lookAt(0, 1, 0)}
      >
        <Scene labels={labels} />
      </Canvas>
      {ROUTE.map((r, i) => (
        <span key={r.block} className="scene-label" ref={(el) => { labels.current[i] = el; }} style={{ opacity: 0 }}>{r.label}</span>
      ))}
      <div className="scene-meta" aria-hidden="true">
        <span>N 12.97° · E 77.59°</span>
        <span>drag-free · move your mouse</span>
      </div>
    </div>
  );
}
