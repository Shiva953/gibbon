import type { Metadata } from "next";
import { Code, Terminal } from "@/components/code";
import { Pipeline } from "@/components/pipeline";
import { Stage } from "@/components/stage";

export const metadata: Metadata = { title: "gibbon import — Adopt what is already live" };

const IMPORT = `
[[p|$]] [[c|gibbon import --profile stage]]
Reading live tasks...
  respect-the-https-proxy-variable  1.00  [[d|(fcfb7a61)]]
  add-a-dry-run-flag                1.00  [[d|(7b2e1f04)]]

Imported 2 bounty(s) into bounties.yaml.
[[a|Verified:]] the generated file reports zero changes against live state.
`;

export default function ImportPage() {
  return (
    <Stage
      href="/import"
      spot="import"
      command="gibbon import"
      title="Adopt what's already live."
      lede="Import reads your live bounties and writes the file. If the result would not match live state exactly, it writes nothing."
      facts={[
        { tone: "sky", text: "run once" },
        { tone: "leaf", text: "checks its own work" },
        { tone: "amber", text: "bounties it did not record stay untouched" },
      ]}
    >
      <div className="mb-6">
        <Pipeline
          label="What import does"
          nodes={[
            { label: "live bounties", sub: "on Gibwork" },
            { label: "import", tone: "amber" },
            { label: "bounties.yaml", sub: "+ state.json" },
            { label: "plan", sub: "no changes", tone: "leaf" },
          ]}
        />
      </div>
      <Terminal title="stage">
        <Code play cursor>
          {IMPORT}
        </Code>
      </Terminal>
    </Stage>
  );
}
