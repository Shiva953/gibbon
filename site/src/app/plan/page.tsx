import type { Metadata } from "next";
import { Code, FilePanel, Terminal } from "@/components/code";
import { ScenarioSwitch, type Scenario } from "@/components/scenario-switch";
import { Stage } from "@/components/stage";

export const metadata: Metadata = { title: "gibbon plan — See it before it happens" };

const FRIDAY_DIFF = `
-- id: stream-leak
-  title: "Connection leak on streamed responses"
-  amount: "1.00"
 - id: docs-quickstart
-  content: "<p>The quickstart is out of date.</p>"
+  content: "<p>The quickstart is out of date. Cover install and auth.</p>"
+- id: http2-alpn
+  title: "HTTP/2 ALPN negotiation fails on macOS"
+  amount: "1.00"
`;

const FRIDAY_PLAN = `
[[p|$]] [[c|gibbon plan --profile stage]]
  [[a|+ create]]   http2-alpn       1.00
  [[u|~ update]]   docs-quickstart  content  [[d|(7b2e1f04)]]
  [[u|~ update]]   timeout-msg      content  [[d|(3d5f8a10)]]
  [[r|- refund]]   stream-leak      Connection leak on streamed responses  [[d|(fcfb7a61)]]
[[d|    2 unchanged]]

Plan: 1 to create, 2 to update, 1 to refund.
`;

const DRIFT_PLAN = `
[[p|$]] [[c|gibbon plan --profile stage]]
  [[u|~ update]]   parser-leak      content  [[d|(bb24ca91)]]
[[d|    4 unchanged]]

Plan: 0 to create, 1 to update, 0 to refund.
`;

const BLOCKED_DIFF = `
 - id: parser-leak
-  amount: "1.00"
+  amount: "5.00"
`;

const BLOCKED_PLAN = `
[[p|$]] [[c|gibbon plan --profile stage]]
  [[w|! blocked]]  parser-leak      [[d|(bb24ca91)]]
[[d|             amount cannot be changed on a live bounty. Refund this bounty and]]
[[d|             create a replacement, or revert the file.]]

Plan: 0 to create, 0 to update, 0 to refund, 1 blocked.
`;

const SCENARIOS: Scenario[] = [
  {
    id: "friday",
    label: "a normal friday",
    caption: "One bounty fixed upstream, two reworded, one new. One file edit, one screen.",
    panel: (
      <>
        <FilePanel title="bounties.yaml" note="git diff, abridged">
          <Code diff>{FRIDAY_DIFF}</Code>
        </FilePanel>
        <Terminal title="stage">
          <Code play>{FRIDAY_PLAN}</Code>
        </Terminal>
      </>
    ),
  },
  {
    id: "drift",
    label: "someone edited it",
    caption: "A teammate changed a bounty in the Gibwork app. The file remembers what it should say.",
    panel: (
      <Terminal title="stage">
        <Code play cursor>
          {DRIFT_PLAN}
        </Code>
      </Terminal>
    ),
  },
  {
    id: "blocked",
    label: "raise a reward",
    caption: "A live bounty's amount is permanent on Gibwork. Plan says so, and why.",
    panel: (
      <>
        <FilePanel title="bounties.yaml" note="git diff">
          <Code diff>{BLOCKED_DIFF}</Code>
        </FilePanel>
        <Terminal title="stage" note="exit 30">
          <Code play>{BLOCKED_PLAN}</Code>
        </Terminal>
      </>
    ),
  },
];

export default function PlanPage() {
  return (
    <Stage
      href="/plan"
      spot="plan"
      command="gibbon plan"
      title="See it before it happens."
      lede="Plan compares your file with live Gibwork and prints every change. It is free, and it changes nothing."
      facts={[
        { tone: "leaf", text: "read-only" },
        { tone: "sky", text: "catches drift" },
        { tone: "amber", text: "explains what is blocked" },
      ]}
    >
      <ScenarioSwitch label="Scenarios" items={SCENARIOS} />
    </Stage>
  );
}
