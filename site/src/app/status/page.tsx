import type { Metadata } from "next";
import { Code, Terminal } from "@/components/code";
import { PlugDemo } from "@/components/plug-demo";
import { Stage } from "@/components/stage";

export const metadata: Metadata = { title: "gibbon status — Pull the plug, still pays once" };

/* Unedited, from testing against stage: kill -9 landed after the payment went through. */
const REAL_RUN = `
[[p|$]] [[c|gibbon apply --profile stage]]
[[w|apply refused:]] resolve the operations above first.

[[p|$]] [[c|gibbon status --profile stage]]
  [[a|v create]]  probe-c   task exists (status: CREATED). Adopted into state.
All clear.
`;

export default function StatusPage() {
  return (
    <Stage
      href="/status"
      command="gibbon status"
      title="Pull the plug. Still pays once."
      lede="A bounty's UUID is written to disk before anything is signed, so status can ask Gibwork what really happened."
      facts={[
        { tone: "amber", text: "disk before signature" },
        { tone: "lychee", text: "a payment is never retried" },
        { tone: "leaf", text: "refunds get the same protection" },
      ]}
      layout="stack"
    >
      <PlugDemo>
        <Terminal title="stage, a real run" note="exit 31, then 0">
          <Code>{REAL_RUN}</Code>
        </Terminal>
      </PlugDemo>
    </Stage>
  );
}
