import type { Metadata } from "next";
import { Code, Terminal } from "@/components/code";
import { Pipeline } from "@/components/pipeline";
import { Stage } from "@/components/stage";

export const metadata: Metadata = { title: "gibbon agent — Describe it, read the diff" };

const AGENT = `
[[p|$]] [[c|gibbon agent "change the reward on fix-142 to 7"]]

Not applied:
  [[w|!]] change the reward on fix-142 to 7
[[d|    amount is immutable on a live bounty. Refund it and create a replacement.]]
`;

export default function AgentPage() {
  return (
    <Stage
      href="/agent"
      spot="agent"
      command='gibbon agent "…"'
      title="Describe it. Read the diff."
      lede="Agent rewrites the file from plain English. It never talks to Gibwork and never sees your wallet."
      facts={[
        { tone: "lychee", text: "no wallet access" },
        { tone: "sky", text: "output is re-parsed" },
        { tone: "leaf", text: "you still run apply" },
      ]}
    >
      <div className="mb-6">
        <Pipeline
          label="Where the model sits"
          nodes={[
            { label: "your request" },
            { label: "agent", sub: "edits a file", tone: "amber" },
            { label: "bounties.yaml" },
            { label: "plan", sub: "you read it" },
            { label: "apply", sub: "you sign", tone: "leaf" },
          ]}
        />
      </div>
      <Terminal title="needs an Anthropic API key">
        <Code play cursor>
          {AGENT}
        </Code>
      </Terminal>
    </Stage>
  );
}
