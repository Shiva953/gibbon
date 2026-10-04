import type { CSSProperties, ReactNode } from "react";

/**
 * Transcripts are written as plain template strings so they read like the
 * terminal. `[[tone|text]]` colours a run:
 *
 *   a create, u update, r refund, w blocked, d dim, p prompt, c typed, k key
 */
const TOKEN = /\[\[([a-z])\|(.*?)\]\]/g;

function renderLine(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of line.matchAll(TOKEN)) {
    if (match.index > last) out.push(line.slice(last, match.index));
    out.push(
      <span key={match.index} className={`t-${match[1]}`}>
        {match[2]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

/** Length of the first typed command, so the typing animation knows how far to go. */
function typedLength(line: string): number {
  const match = /\[\[c\|(.*?)\]\]/.exec(line);
  return match ? match[1]!.length : 0;
}

interface CodeProps {
  children: string;
  /** Tint lines that start with + or - as a diff. */
  diff?: boolean;
  /** Type the first command, then print the rest line by line. */
  play?: boolean;
  /** End with a blinking cursor on a fresh prompt. */
  cursor?: boolean;
  className?: string;
}

export function Code({ children, diff = false, play = false, cursor = false, className = "" }: CodeProps) {
  const lines = children.replace(/^\n/, "").replace(/\n[ \t]*$/, "").split("\n");
  const typed = play ? typedLength(lines[0] ?? "") : 0;

  return (
    <div
      className={`code ${play ? "play" : ""} ${className}`}
      style={play ? ({ "--n": typed, "--t0": "1050ms" } as CSSProperties) : undefined}
    >
      {lines.map((line, index) => {
        const tone = !diff ? "" : line.startsWith("+") ? " add" : line.startsWith("-") ? " del" : "";
        return (
          <span key={index} className={`ln${tone}`} style={play ? ({ "--i": index } as CSSProperties) : undefined}>
            {renderLine(line)}
          </span>
        );
      })}
      {cursor && (
        <span className="ln" style={play ? ({ "--i": lines.length + 2 } as CSSProperties) : undefined}>
          <span className="t-p">$</span> <span className="cursor" />
        </span>
      )}
    </div>
  );
}

interface PanelProps {
  title?: string;
  /** Right-aligned note in the title bar: an exit code, "git diff", "abridged". */
  note?: string;
  className?: string;
  children: ReactNode;
}

const BAR = "flex h-9 items-center justify-between gap-4 border-b border-line px-4 text-[12px]";

/** What happened: a terminal. */
export function Terminal({ title = "zsh", note, className = "", children }: PanelProps) {
  return (
    <div className={`overflow-hidden border border-line bg-panel ${className}`}>
      <div className={`${BAR} text-faint`}>
        <span className="flex items-center gap-3 truncate">
          <span aria-hidden="true" className="flex gap-1.5">
            <i className="size-2 bg-edge" />
            <i className="size-2 bg-edge" />
            <i className="size-2 bg-edge" />
          </span>
          {title}
        </span>
        {note && <span className="shrink-0 border border-amber/40 px-1.5 text-amber">{note}</span>}
      </div>
      {children}
    </div>
  );
}

/** What you want: a file. */
export function FilePanel({ title, note, className = "", children }: PanelProps) {
  return (
    <div className={`overflow-hidden border border-line bg-raised ${className}`}>
      <div className={`${BAR} text-dim`}>
        <span className="truncate text-text">{title}</span>
        {note && <span className="shrink-0 text-faint">{note}</span>}
      </div>
      {children}
    </div>
  );
}

/** Inline code in a sentence. */
export function C({ children }: { children: ReactNode }) {
  return <code className="ic">{children}</code>;
}
