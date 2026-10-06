import type { Metadata } from "next";
import { Code } from "@/components/code";
import { Glyph, type GlyphKind } from "@/components/logo";
import { Stage } from "@/components/stage";
import { REPO_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Gibbon internals — Three inputs, one pure function" };

const SOURCES = [
  {
    role: "what you want",
    file: "bounties.yaml",
    code: `
- [[k|id]]: fix-142
  [[k|title]]: "Fix memory leak"
  [[k|amount]]: "1.00"
`,
  },
  {
    role: "what you made",
    file: ".gibwork/state.json",
    key: true,
    code: `
"fix-142": {
  "[[k|taskId]]": "3f9c8a21-…"
}
`,
  },
  {
    role: "what exists",
    file: "gibwork, live",
    code: `
3f9c8a21-…
Fix memory leak
1.00 USDC, open
`,
  },
];

const RESULTS: { kind?: GlyphKind; label: string }[] = [
  { kind: "add", label: "create" },
  { kind: "upd", label: "update" },
  { kind: "del", label: "refund" },
  { kind: "warn", label: "blocked" },
  { label: "unchanged" },
];

const TONE = {
  add: "text-leaf",
  upd: "text-sky",
  del: "text-lychee",
  warn: "text-amber",
  none: "text-dim",
} as const;

/* The rules in computePlan(), in the order the code checks them. */
const RULES: { file: string; tracked: string; live: string; result: string; tone: keyof typeof TONE }[] = [
  { file: "yes", tracked: "no", live: "anything", result: "create", tone: "add" },
  { file: "yes", tracked: "yes", live: "identical", result: "unchanged", tone: "none" },
  { file: "yes", tracked: "yes", live: "content, deadline or verified-only differs", result: "update", tone: "upd" },
  { file: "yes", tracked: "yes", live: "title, tags, amount or mint differs", result: "blocked", tone: "warn" },
  { file: "yes", tracked: "yes", live: "missing, closed or refunded", result: "blocked", tone: "warn" },
  { file: "no", tracked: "yes", live: "open and refundable", result: "refund", tone: "del" },
  { file: "no", tracked: "yes", live: "open, escrow held by submissions", result: "blocked", tone: "warn" },
  { file: "no", tracked: "yes", live: "already closed", result: "dropped", tone: "none" },
  { file: "no", tracked: "no", live: "live, posted some other way", result: "ignored", tone: "none" },
];

const TH = "border-b border-line px-3 py-2 text-left font-normal text-faint";
const TD = "border-b border-line px-3 py-2 align-top";

export default function InternalsPage() {
  return (
    <Stage
      href="/internals"
      title="Three inputs. One pure function."
      lede="Every decision that can move money is made in computePlan: no network, no clock, no disk."
      facts={[
        { tone: "amber", text: "the middle file is why you never type a UUID" },
        { tone: "leaf", text: "100 offline tests" },
      ]}
      layout="stack"
    >
      <div className="grid gap-px border border-line bg-line md:grid-cols-3">
        {SOURCES.map((source) => (
          <article key={source.file} className={source.key ? "bg-amber/[0.07]" : "bg-bg"}>
            <p className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5 text-[12.5px]">
              <span className={source.key ? "font-bold text-amber" : "font-bold"}>{source.file}</span>
              <span className="text-faint">{source.role}</span>
            </p>
            <Code>{source.code}</Code>
          </article>
        ))}
      </div>

      {/* Three lines down, one line out. Hidden when the panels stack. */}
      <svg viewBox="0 0 1200 44" preserveAspectRatio="none" aria-hidden="true" className="hidden h-11 w-full md:block">
        <path d="M200 0 V20 H1000 V0 M600 0 V44" fill="none" stroke="#4a4333" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="mt-6 flex flex-col items-center gap-5 md:mt-0">
        <p className="border border-amber bg-amber/10 px-5 py-2 text-[15px] font-bold text-amber">computePlan()</p>
        <ul aria-label="What a plan can say" className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-[14px]">
          {RESULTS.map((result) => (
            <li key={result.label} className="flex items-center gap-2.5">
              {result.kind ? <Glyph kind={result.kind} className="text-[12px]" /> : <span aria-hidden="true" className="flex size-[15px] items-center justify-center bg-edge text-[12px] font-bold">=</span>}
              {result.label}
            </li>
          ))}
        </ul>
      </div>

      <details className="group mt-10 border border-line bg-panel">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-[13.5px] font-bold hover:text-amber [&::-webkit-details-marker]:hidden">
          The whole decision table
          <span aria-hidden="true" className="text-faint group-open:hidden">
            show 9 rules
          </span>
          <span aria-hidden="true" className="hidden text-faint group-open:inline">
            hide
          </span>
        </summary>
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th scope="col" className={TH}>in file</th>
                <th scope="col" className={TH}>tracked</th>
                <th scope="col" className={TH}>on gibwork</th>
                <th scope="col" className={TH}>result</th>
              </tr>
            </thead>
            <tbody>
              {RULES.map((rule) => (
                <tr key={`${rule.file}-${rule.tracked}-${rule.live}`}>
                  <td className={TD}>{rule.file}</td>
                  <td className={TD}>{rule.tracked}</td>
                  <td className={`${TD} text-dim`}>{rule.live}</td>
                  <td className={`${TD} font-bold ${TONE[rule.tone]}`}>{rule.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 text-[12.5px] text-dim">
          Module map, the create sequence and the recovery verdicts are in the{" "}
          <a href={`${REPO_URL}#architecture`} className="text-amber underline underline-offset-4">
            README
          </a>
          .
        </p>
      </details>
    </Stage>
  );
}
