import type { Metadata } from "next";
import { Code, FilePanel } from "@/components/code";
import { Pipeline } from "@/components/pipeline";
import { Stage } from "@/components/stage";
import { INSTALL_COMMAND } from "@/lib/site";

export const metadata: Metadata = { title: "Gibbon in CI — Preview on PR, apply on merge" };

const WORKFLOW = `
[[k|jobs]]:
  [[k|plan]]:                          [[d|# on every pull request]]
    [[k|steps]]:
      - [[k|run]]: ${INSTALL_COMMAND}
      - [[k|run]]: gibbon plan --environment stage

  [[k|apply]]:                         [[d|# on merge to main]]
    [[k|environment]]: gibwork         [[d|# add a required reviewer here]]
    [[k|steps]]:
      - [[k|run]]: gibbon status --environment stage
      - [[k|run]]: gibbon apply --yes --environment stage
      - [[k|run]]: git add -f .gibwork/state.json && git commit && git push
`;

export default function CiPage() {
  return (
    <Stage
      href="/ci"
      spot="ci"
      title="Preview on PR. Apply on merge."
      lede="A bounty change becomes a diff your team reviews before it spends money."
      facts={[
        { tone: "sky", text: "plan on every pull request" },
        { tone: "amber", text: "a reviewer gates apply" },
        { tone: "leaf", text: "state is committed back" },
      ]}
    >
      <div className="mb-6">
        <Pipeline
          label="A bounty change in CI"
          nodes={[
            { label: "pull request", sub: "edits the file" },
            { label: "gibbon plan", sub: "posts the diff", tone: "sky" },
            { label: "merge" },
            { label: "approve", sub: "required reviewer", tone: "amber" },
            { label: "gibbon apply", sub: "money moves", tone: "leaf" },
          ]}
        />
      </div>
      <FilePanel title=".github/workflows/bounties.yml" note="abridged, full file in the README">
        <Code>{WORKFLOW}</Code>
      </FilePanel>
    </Stage>
  );
}
