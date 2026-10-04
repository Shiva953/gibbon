const TONE = {
  plain: "border-line",
  amber: "border-amber/60 text-amber",
  leaf: "border-leaf/60 text-leaf",
  sky: "border-sky/60 text-sky",
  lychee: "border-lychee/60 text-lychee",
} as const;

export interface PipeNode {
  label: string;
  /** A second, quieter line: who does it, or what it touches. */
  sub?: string;
  tone?: keyof typeof TONE;
}

/** A left-to-right sequence of steps, joined by lines. Wraps on narrow screens. */
export function Pipeline({ label, nodes }: { label: string; nodes: PipeNode[] }) {
  return (
    <ol aria-label={label} className="flex flex-wrap items-stretch gap-y-3 text-[12.5px]">
      {nodes.map((node, index) => (
        <li key={node.label} className="flex items-stretch">
          <div className={`flex flex-col justify-center border bg-panel px-3 py-2 ${TONE[node.tone ?? "plain"]}`}>
            <span className="font-bold whitespace-nowrap">{node.label}</span>
            {node.sub && <span className="whitespace-nowrap text-faint">{node.sub}</span>}
          </div>
          {index < nodes.length - 1 && (
            <span aria-hidden="true" className="flex w-7 items-center">
              <span className="h-px flex-1 bg-edge" />
              <span className="size-0 border-y-[4px] border-l-[6px] border-y-transparent border-l-edge" />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
