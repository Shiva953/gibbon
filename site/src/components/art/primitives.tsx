/*
 * Building blocks for the illustrations: flat isometric layers, shaded with
 * dither instead of gradients. Everything is computed, so whatever sits on a
 * layer follows it wherever the layer is placed.
 */

export type P = readonly [number, number];
/** Four corners of a face. For an isometric layer: left, top, right, bottom. */
export type Quad = readonly [P, P, P, P];

export const INK = {
  cream: "#f1ead9",
  creamDim: "#ddd4bf",
  bar: "#27302c",
  cobalt: "#3b6fe0",
  cobaltDeep: "#2a52b0",
  coral: "#f2664a",
  coralDeep: "#c44a32",
  leaf: "#5fd38d",
  amber: "#ffb224",
  amberDeep: "#d48a06",
  lychee: "#ff7b6b",
  sky: "#78a9ff",
  teal: "#1d3531",
  tealDeep: "#12231f",
  night: "#0e0d0b",
} as const;

const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** The point at (u, v) on a face, both 0 to 1. */
export const at = (q: Quad, u: number, v: number): P => lerp(lerp(q[0], q[1], u), lerp(q[3], q[2], u), v);

export const pts = (...points: P[]) => points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/** A rectangle drawn on a face, as polygon points. */
export const patch = (q: Quad, u0: number, v0: number, u1: number, v1: number) =>
  pts(at(q, u0, v0), at(q, u1, v0), at(q, u1, v1), at(q, u0, v1));

/**
 * Turns a shape's alpha into solid dots of one colour: dense where the shape
 * is opaque, sparse where it fades. Fill the shape with an opacity gradient.
 */
export function Dither({ id, color, seed = 3, grain = 0.8 }: { id: string; color: string; seed?: number; grain?: number }) {
  return (
    <filter id={id} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency={grain} numOctaves="1" seed={seed} result="noise" />
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3.2 0 0 0 -1.1" result="threshold" />
      <feComposite in="SourceAlpha" in2="threshold" operator="arithmetic" k1="0" k2="1" k3="-1" k4="0" result="kept" />
      <feComponentTransfer in="kept" result="dots">
        <feFuncA type="linear" slope="60" intercept="0" />
      </feComponentTransfer>
      <feFlood floodColor={color} />
      <feComposite in2="dots" operator="in" />
    </filter>
  );
}

/** Print grain over a whole illustration. */
export function Grain({ id }: { id: string }) {
  return (
    <filter id={id} x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="9" stitchTiles="stitch" />
      <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.1 -0.42" />
    </filter>
  );
}

/** A flat diamond seen from above: left, top, right, bottom. */
export const iso = (cx: number, cy: number, w: number, h = w / 2): Quad => [
  [cx - w, cy],
  [cx, cy - h],
  [cx + w, cy],
  [cx, cy + h],
];

interface PlaneProps {
  q: Quad;
  face: string;
  /** The two visible edges: the lighter one faces right, the darker one left. */
  edge: string;
  edgeDeep: string;
  thickness?: number;
  /** Draw only an outline: a layer that does not exist yet. */
  ghost?: boolean;
}

/** One layer of the stack: a slab with a coloured edge. */
export function Plane({ q, face, edge, edgeDeep, thickness = 14, ghost = false }: PlaneProps) {
  const [l, t, r, b] = q;
  if (ghost) {
    return <polygon points={pts(l, t, r, b)} fill="none" stroke={face} strokeWidth="2.5" strokeDasharray="7 7" />;
  }
  return (
    <g>
      <polygon points={pts(l, b, [b[0], b[1] + thickness], [l[0], l[1] + thickness])} fill={edgeDeep} />
      <polygon points={pts(b, r, [r[0], r[1] + thickness], [b[0], b[1] + thickness])} fill={edge} />
      <polygon points={pts(l, t, r, b)} fill={face} />
    </g>
  );
}

type Span = readonly [number, number];

/** A marked cell on a layer. Dashed means "should be here, is not". */
export function Tile({ q, u, v, fill, dashed = false }: { q: Quad; u: Span; v: Span; fill: string; dashed?: boolean }) {
  const points = patch(q, u[0], v[0], u[1], v[1]);
  return dashed ? (
    <polygon points={points} fill="none" stroke={fill} strokeWidth="2.5" strokeDasharray="5 5" />
  ) : (
    <polygon points={points} fill={fill} />
  );
}

interface PillarProps {
  /** Unique within the SVG: names this pillar's gradients. */
  id: string;
  upper: Quad;
  lower: Quad;
  u: Span;
  v: Span;
  /** Id of the Dither filter that gives the pillar its colour. */
  filter: string;
  /** Thin out toward the layer where the bounty is missing. */
  fade?: "none" | "down" | "up";
  /** How much of the cell the column covers, 0 to 1. */
  inset?: number;
}

/** A column of dotted light joining the same cell on two layers. */
export function Pillar({ id, upper, lower, u, v, filter, fade = "none", inset = 0.5 }: PillarProps) {
  const shrink = ([a, b]: Span): Span => {
    const mid = (a + b) / 2;
    const half = ((b - a) / 2) * inset;
    return [mid - half, mid + half];
  };
  const [u0, u1] = shrink(u);
  const [v0, v1] = shrink(v);
  const left = at(upper, u0, v0);
  const front = at(upper, u0, v1);
  const right = at(upper, u1, v1);
  const left2 = at(lower, u0, v0);
  const front2 = at(lower, u0, v1);
  const right2 = at(lower, u1, v1);
  const [from, to] = fade === "down" ? [0.8, 0] : fade === "up" ? [0, 0.8] : [0.56, 0.56];

  return (
    <g>
      <defs>
        {[
          { key: "l", k: 0.5 },
          { key: "r", k: 1 },
        ].map(({ key, k }) => (
          <linearGradient key={key} id={`${id}-${key}`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={left[1]} y2={front2[1]}>
            <stop offset="0" stopOpacity={from * k} />
            <stop offset="1" stopOpacity={to * k} />
          </linearGradient>
        ))}
      </defs>
      <polygon points={pts(left, front, front2, left2)} fill={`url(#${id}-l)`} filter={`url(#${filter})`} />
      <polygon points={pts(front, right, right2, front2)} fill={`url(#${id}-r)`} filter={`url(#${filter})`} />
    </g>
  );
}

/** A stack of coins seen from slightly above. */
export function Coins({ x, y, count = 3, r = 40 }: { x: number; y: number; count?: number; r?: number }) {
  const ry = r * 0.34;
  const thick = r * 0.3;
  return (
    <g>
      {Array.from({ length: count }, (_, index) => {
        const top = y - index * (thick + 2);
        return (
          <g key={index}>
            <path
              d={`M${x - r} ${top} v${thick} a${r} ${ry} 0 0 0 ${r * 2} 0 v${-thick} Z`}
              fill={INK.amberDeep}
            />
            <ellipse cx={x} cy={top} rx={r} ry={ry} fill={INK.amber} />
            <ellipse cx={x} cy={top} rx={r * 0.66} ry={ry * 0.66} fill="none" stroke={INK.amberDeep} strokeWidth="2.5" />
          </g>
        );
      })}
    </g>
  );
}
