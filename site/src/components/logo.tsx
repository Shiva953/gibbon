/**
 * The mark: a lowercase g drawn as a commit node with a branch leaving it.
 * The bowl is the node, the tail is the branch, the dot is where it lands.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="7" fill="#ffb224" />
      <circle cx="14.5" cy="13" r="5.75" fill="none" stroke="#0e0d0b" strokeWidth="3.1" />
      <path
        d="M21.8 6.6 V19.2 C21.8 23.4 18.9 25.6 15.2 25.6 H12.4"
        fill="none"
        stroke="#0e0d0b"
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.9" cy="25.6" r="2.3" fill="#0e0d0b" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark className="size-7" />
      <span className="text-[1.15rem] leading-none font-extrabold tracking-[-0.04em]">gibbon</span>
    </span>
  );
}

export function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.77-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.19c0 .21.15.46.55.38A8 8 0 0 0 8 0Z"
      />
    </svg>
  );
}

const GLYPH = {
  add: { mark: "+", tone: "bg-leaf" },
  upd: { mark: "~", tone: "bg-sky" },
  del: { mark: "−", tone: "bg-lychee" },
  warn: { mark: "!", tone: "bg-amber" },
} as const;

export type GlyphKind = keyof typeof GLYPH;

/** One of the four plan marks, as a solid cell. Sized by the surrounding font size. */
export function Glyph({ kind, className = "" }: { kind: GlyphKind; className?: string }) {
  const { mark, tone } = GLYPH[kind];
  return (
    <span
      aria-hidden="true"
      className={`inline-flex size-[1.25em] shrink-0 items-center justify-center font-bold text-bg ${tone} ${className}`}
    >
      {mark}
    </span>
  );
}
