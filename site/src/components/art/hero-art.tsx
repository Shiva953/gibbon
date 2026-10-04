import { Coins, Dither, Grain, INK, Pillar, Plane, Tile, at, iso, patch } from "./primitives";

/*
 * The three things Gibbon compares, as a stack: the file on top, the state
 * file in the middle, live Gibwork underneath. Each bounty is a column of
 * light through the layers. Where a column thins out, that bounty is missing
 * from a layer, and that gap is exactly what the plan on the right reports.
 */

const CX = 282;
const FILE = iso(CX, 128, 212);
const STATE = iso(CX, 300, 212);
const LIVE = iso(CX, 472, 212);

const V = [0.3, 0.74] as const;

/** One bounty per column, front to back, and the layers it exists in. */
const BOUNTIES = [
  { id: "create", color: INK.leaf, filter: "hero-leaf", u: [0.07, 0.25], file: true, state: false, live: false, w: 92 },
  { id: "update", color: INK.sky, filter: "hero-sky", u: [0.3, 0.48], file: true, state: true, live: true, w: 124 },
  { id: "refund", color: INK.lychee, filter: "hero-lychee", u: [0.53, 0.71], file: false, state: true, live: true, w: 74 },
  { id: "blocked", color: INK.amber, filter: "hero-amber", u: [0.76, 0.94], file: true, state: true, live: true, w: 108 },
] as const;

const CARD = { x: 600, y: 196, w: 246, h: 196 };

function Label({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <text x={x} y={y} fontSize="13.5" fontWeight="500" fill="#9a917c" className="font-mono">
      {children}
    </text>
  );
}

export function HeroArt({ className }: { className?: string }) {
  /* Back columns first, so nearer ones overlap them. */
  const backToFront = [...BOUNTIES].reverse();

  return (
    <svg
      viewBox="0 0 880 620"
      role="img"
      aria-label="Three stacked layers: the bounty file, the state file, and live Gibwork. Four columns of light run through them, one per bounty, and a plan card beside the stack lists create, update, refund and blocked."
      className={className}
    >
      <defs>
        <Dither id="hero-leaf" color={INK.leaf} seed={4} />
        <Dither id="hero-sky" color={INK.sky} seed={8} />
        <Dither id="hero-lychee" color={INK.lychee} seed={5} />
        <Dither id="hero-amber" color={INK.amber} seed={2} />
        <Dither id="hero-glow" color={INK.amber} seed={3} grain={0.7} />
        <Dither id="hero-shade" color="#000" seed={6} grain={0.9} />
        <Grain id="hero-grain" />
        <radialGradient id="hero-halo" gradientUnits="userSpaceOnUse" cx={CARD.x + CARD.w / 2} cy={CARD.y + CARD.h / 2} r="186">
          <stop offset="0.45" stopOpacity="0.4" />
          <stop offset="1" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hero-floor" gradientUnits="userSpaceOnUse" cx={CX} cy="596" r="300" gradientTransform="translate(0 453) scale(1 0.24)">
          <stop offset="0" stopOpacity="0.95" />
          <stop offset="1" stopOpacity="0" />
        </radialGradient>
        <clipPath id="hero-clip">
          <rect width="880" height="620" rx="14" />
        </clipPath>
      </defs>

      <g clipPath="url(#hero-clip)">
        <rect width="880" height="620" fill="#14120e" />

        {/* A floor receding behind everything. */}
        <g stroke="#ffffff" strokeOpacity="0.065" strokeWidth="1.2">
          {[452, 474, 502, 540, 592].map((y) => (
            <line key={y} x1="0" x2="880" y1={y} y2={y} />
          ))}
          {[-520, -300, -140, -40, 40, 140, 300, 520].map((dx) => (
            <line key={dx} x1={560 + dx * 0.34} y1="452" x2={560 + dx * 2.6} y2="620" />
          ))}
        </g>

        <circle cx={CARD.x + CARD.w / 2} cy={CARD.y + CARD.h / 2} r="186" fill="url(#hero-halo)" filter="url(#hero-glow)" />
        <ellipse cx={CX} cy="596" rx="300" ry="42" fill="url(#hero-floor)" filter="url(#hero-shade)" opacity="0.6" />

        {/* Live Gibwork: what exists. */}
        <Plane q={LIVE} face={INK.cream} edge={INK.coral} edgeDeep={INK.coralDeep} thickness={16} />
        {BOUNTIES.map((bounty) => {
          const [cx, cy] = at(LIVE, (bounty.u[0] + bounty.u[1]) / 2, (V[0] + V[1]) / 2);
          return bounty.live ? (
            <g key={bounty.id}>
              <Tile q={LIVE} u={bounty.u} v={V} fill="#fff" />
              <ellipse cx={cx} cy={cy} rx="15" ry="7.5" fill={INK.amber} stroke={INK.amberDeep} strokeWidth="2.5" />
            </g>
          ) : (
            <Tile key={bounty.id} q={LIVE} u={bounty.u} v={V} fill={bounty.color} dashed />
          );
        })}

        {backToFront.map(
          (bounty) =>
            bounty.live && (
              <Pillar key={bounty.id} id={`hero-low-${bounty.id}`} upper={STATE} lower={LIVE} u={bounty.u} v={V} filter={bounty.filter} />
            ),
        )}

        {/* The state file: what Gibbon recorded. */}
        <Plane q={STATE} face={INK.teal} edge={INK.amber} edgeDeep={INK.amberDeep} thickness={16} />
        {BOUNTIES.map((bounty) =>
          bounty.state ? (
            <g key={bounty.id}>
              <Tile q={STATE} u={bounty.u} v={V} fill={INK.cream} />
              <polygon points={patch(STATE, bounty.u[0] + 0.03, 0.4, bounty.u[1] - 0.03, 0.48)} fill={INK.bar} />
              <polygon points={patch(STATE, bounty.u[0] + 0.03, 0.56, bounty.u[1] - 0.03, 0.64)} fill={INK.amberDeep} />
            </g>
          ) : (
            <Tile key={bounty.id} q={STATE} u={bounty.u} v={V} fill={bounty.color} dashed />
          ),
        )}

        {backToFront.map((bounty) => {
          const fade = bounty.file && bounty.state ? "none" : bounty.file ? "down" : "up";
          return (
            <Pillar key={bounty.id} id={`hero-high-${bounty.id}`} upper={FILE} lower={STATE} u={bounty.u} v={V} filter={bounty.filter} fade={fade} />
          );
        })}

        {/* The file: what you want. */}
        <Plane q={FILE} face={INK.cream} edge={INK.cobalt} edgeDeep={INK.cobaltDeep} thickness={16} />
        <polygon points={patch(FILE, 0, 0, 1, 0.14)} fill={INK.creamDim} />
        {[0.05, 0.1, 0.15].map((u, index) => {
          const [cx, cy] = at(FILE, u, 0.07);
          return <ellipse key={u} cx={cx} cy={cy} rx="5.4" ry="2.9" fill={[INK.coral, INK.amber, INK.leaf][index]} />;
        })}
        {BOUNTIES.map((bounty) =>
          bounty.file ? (
            <g key={bounty.id}>
              <Tile q={FILE} u={bounty.u} v={V} fill={bounty.color} />
              <polygon points={patch(FILE, bounty.u[0] + 0.03, 0.4, bounty.u[1] - 0.03, 0.48)} fill={INK.night} opacity="0.75" />
              <polygon points={patch(FILE, bounty.u[0] + 0.03, 0.56, bounty.u[1] - 0.07, 0.64)} fill={INK.night} opacity="0.45" />
            </g>
          ) : (
            <Tile key={bounty.id} q={FILE} u={bounty.u} v={V} fill={bounty.color} dashed />
          ),
        )}

        {/* What the comparison prints. */}
        <line
          x1={STATE[2][0] + 6}
          y1={STATE[2][1]}
          x2={CARD.x - 8}
          y2={CARD.y + CARD.h / 2}
          stroke={INK.cream}
          strokeWidth="2.5"
          strokeDasharray="2 9"
          strokeLinecap="round"
        />
        <g>
          <rect x={CARD.x + 9} y={CARD.y + 9} width={CARD.w} height={CARD.h} fill={INK.amberDeep} />
          <rect x={CARD.x} y={CARD.y} width={CARD.w} height={CARD.h} fill={INK.night} stroke={INK.amber} strokeWidth="4" />
          <line x1={CARD.x} x2={CARD.x + CARD.w} y1={CARD.y + 34} y2={CARD.y + 34} stroke={INK.amber} strokeWidth="2" opacity="0.5" />
          {[0, 1, 2].map((index) => (
            <rect key={index} x={CARD.x + 16 + index * 15} y={CARD.y + 13} width="9" height="9" fill={INK.amber} opacity="0.55" />
          ))}
          <text x={CARD.x + CARD.w - 16} y={CARD.y + 23} textAnchor="end" fontSize="13.5" fontWeight="700" fill={INK.amber} className="font-mono">
            plan
          </text>
          {BOUNTIES.map((bounty, index) => {
            const y = CARD.y + 66 + index * 33;
            return (
              <g key={bounty.id}>
                <rect x={CARD.x + 22} y={y - 8} width="16" height="16" fill={bounty.color} />
                <rect x={CARD.x + 52} y={y - 6} width={bounty.w} height="12" fill={bounty.color} />
                <rect x={CARD.x + 62 + bounty.w} y={y - 6} width={150 - bounty.w} height="12" fill="#ffffff" opacity="0.14" />
              </g>
            );
          })}
        </g>

        <Coins x={770} y={548} count={3} r={44} />
        <Coins x={672} y={576} count={1} r={31} />

        <Label x={34} y={FILE[0][1] + 78}>
          bounties.yaml
        </Label>
        <Label x={34} y={STATE[0][1] + 78}>
          state.json
        </Label>
        <Label x={34} y={LIVE[0][1] + 82}>
          gibwork, live
        </Label>

        <rect width="880" height="620" filter="url(#hero-grain)" opacity="0.5" style={{ mixBlendMode: "soft-light" }} />
      </g>
    </svg>
  );
}
