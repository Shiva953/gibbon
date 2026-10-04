import { Coins, Dither, INK, Pillar, Plane, Tile, at, iso } from "./primitives";

/*
 * Small illustrations, one per tab, built from the same parts as the hero:
 * layers, columns of light, coins.
 */

/* Far enough apart that the columns between them show. */
const UPPER = iso(150, 58, 104);
const LOWER = iso(150, 158, 104);
const V = [0.28, 0.76] as const;
const COLUMNS = [
  [0.1, 0.34],
  [0.4, 0.64],
  [0.7, 0.94],
] as const;

function Coin({ q, u }: { q: typeof LOWER; u: readonly [number, number] }) {
  const [cx, cy] = at(q, (u[0] + u[1]) / 2, (V[0] + V[1]) / 2);
  return <ellipse cx={cx} cy={cy} rx="10" ry="5" fill={INK.amber} stroke={INK.amberDeep} strokeWidth="2" />;
}

export type SpotKind = "plan" | "apply" | "import" | "agent" | "ci";

const LABEL: Record<SpotKind, string> = {
  plan: "The file layer above the live layer. One column fades downward, one runs through, one fades upward.",
  apply: "One stack of coins, and the outline of a second stack that was never paid.",
  import: "Columns rise from the live layer into the outline of a file that is being written.",
  agent: "A request bubble points at one cell of a file layer.",
  ci: "A branch leaves the main line, merges back, and passes a gate before the last step.",
};

export function SpotArt({ kind, className }: { kind: SpotKind; className?: string }) {
  return (
    <svg viewBox="0 0 360 224" role="img" aria-label={LABEL[kind]} className={className}>
      {kind === "plan" && (
        <>
          <defs>
            <Dither id="spot-leaf" color={INK.leaf} seed={4} grain={0.9} />
            <Dither id="spot-sky" color={INK.sky} seed={8} grain={0.9} />
            <Dither id="spot-lychee" color={INK.lychee} seed={5} grain={0.9} />
          </defs>
          <Plane q={LOWER} face={INK.cream} edge={INK.coral} edgeDeep={INK.coralDeep} thickness={11} />
          <Tile q={LOWER} u={COLUMNS[0]} v={V} fill={INK.leaf} dashed />
          <Tile q={LOWER} u={COLUMNS[1]} v={V} fill="#fff" />
          <Coin q={LOWER} u={COLUMNS[1]} />
          <Tile q={LOWER} u={COLUMNS[2]} v={V} fill="#fff" />
          <Coin q={LOWER} u={COLUMNS[2]} />
          <Pillar id="spot-plan-c" upper={UPPER} lower={LOWER} u={COLUMNS[2]} v={V} filter="spot-lychee" fade="up" />
          <Pillar id="spot-plan-b" upper={UPPER} lower={LOWER} u={COLUMNS[1]} v={V} filter="spot-sky" />
          <Pillar id="spot-plan-a" upper={UPPER} lower={LOWER} u={COLUMNS[0]} v={V} filter="spot-leaf" fade="down" />
          <Plane q={UPPER} face={INK.cream} edge={INK.cobalt} edgeDeep={INK.cobaltDeep} thickness={11} />
          <Tile q={UPPER} u={COLUMNS[0]} v={V} fill={INK.leaf} />
          <Tile q={UPPER} u={COLUMNS[1]} v={V} fill={INK.sky} />
          <Tile q={UPPER} u={COLUMNS[2]} v={V} fill={INK.lychee} dashed />
          {[INK.leaf, INK.sky, INK.lychee].map((color, index) => (
            <g key={color}>
              <rect x="280" y={74 + index * 26} width="14" height="14" fill={color} />
              <rect x="300" y={77 + index * 26} width={[36, 44, 26][index]} height="8" fill={color} />
            </g>
          ))}
        </>
      )}

      {kind === "apply" && (
        <>
          <Coins x={112} y={152} count={3} r={50} />
          <g fill="none" stroke={INK.lychee} strokeWidth="2.5" strokeDasharray="5 6">
            <ellipse cx="262" cy="152" rx="50" ry="17" />
            <path d="M212 152 v16 a50 17 0 0 0 100 0 v-16" />
            <ellipse cx="262" cy="135" rx="50" ry="17" />
            <ellipse cx="262" cy="118" rx="50" ry="17" />
          </g>
          <rect x="190" y="40" width="24" height="24" fill={INK.leaf} />
          <path d="M196 52 l5 5 9 -10" fill="none" stroke={INK.night} strokeWidth="3.2" strokeLinecap="square" />
          <text x="224" y="58" fontSize="15" fontWeight="700" fill={INK.cream} className="font-mono">
            once
          </text>
        </>
      )}

      {kind === "import" && (
        <>
          <defs>
            <Dither id="spot-rise" color={INK.sky} seed={8} grain={0.9} />
          </defs>
          <Plane q={LOWER} face={INK.cream} edge={INK.coral} edgeDeep={INK.coralDeep} thickness={11} />
          {COLUMNS.map((u) => (
            <g key={u[0]}>
              <Tile q={LOWER} u={u} v={V} fill="#fff" />
              <Coin q={LOWER} u={u} />
            </g>
          ))}
          {[...COLUMNS].reverse().map((u) => (
            <Pillar key={u[0]} id={`spot-import-${u[0]}`} upper={UPPER} lower={LOWER} u={u} v={V} filter="spot-rise" fade="up" />
          ))}
          <Plane q={UPPER} face={INK.cream} edge="" edgeDeep="" ghost />
          {COLUMNS.map((u) => (
            <Tile key={u[0]} q={UPPER} u={u} v={V} fill={INK.cream} />
          ))}
        </>
      )}

      {kind === "agent" && (
        <>
          <Plane q={iso(214, 138, 128)} face={INK.cream} edge={INK.cobalt} edgeDeep={INK.cobaltDeep} thickness={11} />
          <Tile q={iso(214, 138, 128)} u={COLUMNS[0]} v={V} fill={INK.creamDim} />
          <Tile q={iso(214, 138, 128)} u={COLUMNS[1]} v={V} fill={INK.amber} />
          <Tile q={iso(214, 138, 128)} u={COLUMNS[2]} v={V} fill={INK.creamDim} />
          <path d="M14 14 h128 v70 h-76 l-20 20 v-20 h-32 z" fill={INK.night} stroke={INK.amber} strokeWidth="3" />
          {[32, 48, 64].map((y, index) => (
            <rect key={y} x="30" y={y} width={[92, 70, 84][index]} height="7" fill={INK.cream} opacity="0.85" />
          ))}
          <path d="M150 62 C186 66 204 92 212 124" fill="none" stroke={INK.amber} strokeWidth="2.5" strokeDasharray="2 8" strokeLinecap="round" />
        </>
      )}

      {kind === "ci" && (
        <g fill="none" strokeWidth="4" strokeLinecap="round">
          <path d="M20 150 H340" stroke="#4a4333" />
          <path d="M62 150 C92 150 96 78 130 78 H186 C220 78 224 150 254 150" stroke={INK.sky} />
          <circle cx="62" cy="150" r="10" fill={INK.night} stroke={INK.cream} />
          <circle cx="130" cy="78" r="10" fill={INK.night} stroke={INK.sky} />
          <circle cx="186" cy="78" r="10" fill={INK.sky} stroke={INK.sky} />
          <circle cx="254" cy="150" r="10" fill={INK.night} stroke={INK.cream} />
          <rect x="284" y="134" width="32" height="32" transform="rotate(45 300 150)" fill={INK.amber} stroke="none" />
          <path d="M293 150 l5 5 9 -10" stroke={INK.night} strokeWidth="3.2" strokeLinecap="square" />
          <text x="158" y="54" textAnchor="middle" fontSize="13" fill="#9a917c" stroke="none" className="font-mono">
            plan
          </text>
          <text x="300" y="198" textAnchor="middle" fontSize="13" fill="#9a917c" stroke="none" className="font-mono">
            apply
          </text>
        </g>
      )}
    </svg>
  );
}
