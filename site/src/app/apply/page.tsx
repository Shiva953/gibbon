import type { Metadata } from "next";
import { Code, Terminal } from "@/components/code";
import { ScenarioSwitch, type Scenario } from "@/components/scenario-switch";
import { Stage } from "@/components/stage";

export const metadata: Metadata = { title: "gibbon apply — Run it twice, pay once" };

/*
 * The Friday example from the README: five bounties live, four things changed.
 * The id after "created" and the hash after "refunded" are cut short; the CLI
 * prints them in full.
 */
const FIRST = `
[[p|$]] [[c|gibbon apply --profile stage]]
  [[a|+ create]]   http2-alpn       1.00
  [[u|~ update]]   docs-quickstart  content  [[d|(7b2e1f04)]]
  [[u|~ update]]   timeout-msg      content  [[d|(3d5f8a10)]]
  [[r|- refund]]   stream-leak      Connection leak on streamed responses  [[d|(fcfb7a61)]]
[[d|    2 unchanged]]

Plan: 1 to create, 2 to update, 1 to refund.
Apply these changes to stage? [y/N] [[c|y]]

  updated docs-quickstart (content)
  updated timeout-msg (content)
  created http2-alpn -> 4e1d9c02-…
  refunded stream-leak (3w4B…)

Applied: 1 created, 2 updated, 1 refunded.
`;

const SECOND = `
[[p|$]] [[c|gibbon apply --profile stage]]
[[d|    5 unchanged]]

No changes. bounties.yaml matches live Gibwork state.
`;

const RUNS: Scenario[] = [
  {
    id: "first",
    label: "first run",
    caption: "Five bounties live, four changes. One confirmation, no UUIDs typed.",
    panel: (
      <Terminal title="stage">
        <Code play>{FIRST}</Code>
      </Terminal>
    ),
  },
  {
    id: "second",
    label: "second run",
    caption: "Same command, same file. Nothing to do, so nothing is paid.",
    panel: (
      <Terminal title="stage">
        <Code play cursor>
          {SECOND}
        </Code>
      </Terminal>
    ),
  },
];

function Coin() {
  return <span aria-hidden="true" className="size-5 rounded-full border-2 border-[#d48a06] bg-amber" />;
}

/* Two lanes: what a repeated command costs, and what a repeated file costs. */
function Twice() {
  const lane = "flex flex-wrap items-center gap-x-4 gap-y-2.5 p-4";
  const box = "border border-line bg-bg px-2.5 py-1.5 text-[12px] whitespace-nowrap";
  return (
    <div className="mb-6 border border-line bg-panel text-[13px]">
      <div className={`${lane} border-b border-line`}>
        <span className="w-full text-dim sm:w-44">a command, run twice</span>
        <span className="flex gap-1.5">
          <span className={box}>create</span>
          <span className={box}>create</span>
        </span>
        <span className="flex items-center gap-2 text-lychee">
          <Coin />
          <Coin />
          <span className="ml-1 font-bold">2 bounties, 2.00 USDC</span>
        </span>
      </div>
      <div className={lane}>
        <span className="w-full text-dim sm:w-44">a file, applied twice</span>
        <span className="flex gap-1.5">
          <span className={box}>apply</span>
          <span className={box}>apply</span>
        </span>
        <span className="flex items-center gap-2 text-leaf">
          <Coin />
          <span className="ml-1 font-bold">1 bounty, 1.00 USDC</span>
        </span>
      </div>
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Stage
      href="/apply"
      spot="apply"
      command="gibbon apply"
      title="Run it twice. Pay once."
      lede="Apply makes every change in the plan after one confirmation. Run it again and nothing happens."
      facts={[
        { tone: "leaf", text: "safe to re-run" },
        { tone: "sky", text: "one confirmation" },
        { tone: "amber", text: "no UUIDs typed" },
      ]}
    >
      <Twice />
      <ScenarioSwitch label="Runs" items={RUNS} />
    </Stage>
  );
}
