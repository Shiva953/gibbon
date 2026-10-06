import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Code, FilePanel, Terminal } from "@/components/code";
import { Command } from "@/components/copy-button";
import { Glyph } from "@/components/logo";
import { ScenarioSwitch, type Scenario } from "@/components/scenario-switch";
import { Stage } from "@/components/stage";
import { INSTALL_COMMAND, REPO_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Install Gibbon — Three steps to a live bounty" };

const FILE = `
- [[k|id]]: proxy-env
  [[k|title]]: "Respect the HTTPS_PROXY variable"
  [[k|content]]: "<p>A reused session ignores HTTPS_PROXY. See issue #142.</p>"
  [[k|tags]]: [bug, python]
  [[k|amount]]: "1.00"
`;

const RUN = `
[[p|$]] [[c|gibbon plan --profile stage]]
  [[a|+ create]]   proxy-env        1.00

Plan: 1 to create, 0 to update, 0 to refund.

[[p|$]] [[c|gibbon apply --profile stage]]
`;

/* Two ways in. Running from the repository needs nothing installed globally. */
const WAYS: Scenario[] = [
  {
    id: "repo",
    label: "from the repo",
    caption: "Nothing installed globally. Needs Bun to build.",
    panel: (
      <div className="flex flex-col gap-1.5">
        <Command label="Copy the clone command">{`git clone ${REPO_URL} && cd gibbon`}</Command>
        <Command label="Copy the build command">bun install && bun run build</Command>
        <Command label="Copy the alias command">{'alias gibbon="node $PWD/dist/index.js"'}</Command>
      </div>
    ),
  },
  {
    id: "global",
    label: "global command",
    caption: "One line. It installs from GitHub, not the npm registry.",
    panel: <Command label="Copy the install command">{INSTALL_COMMAND}</Command>,
  },
];

const STEPS: { title: string; panel: ReactNode }[] = [
  {
    title: "get the CLI",
    panel: <ScenarioSwitch label="Ways to get the CLI" items={WAYS} />,
  },
  {
    title: "write bounties.yaml",
    panel: (
      <FilePanel title="bounties.yaml">
        <Code>{FILE}</Code>
      </FilePanel>
    ),
  },
  {
    title: "plan, then apply",
    panel: (
      <Terminal title="stage">
        <Code play cursor>
          {RUN}
        </Code>
      </Terminal>
    ),
  },
];

export default function InstallPage() {
  return (
    <Stage
      href="/install"
      title="Three steps to a live bounty."
      lede="Needs Node.js 22 or newer. Already use the Gibwork CLI? Your wallet is set up: just pass --profile."
      controls={
        <p className="flex max-w-[30rem] gap-3 border border-amber/50 bg-amber/[0.07] p-3.5 text-[13px] leading-relaxed">
          <Glyph kind="warn" className="mt-0.5 text-[12px]" />
          <span>
            <strong className="font-bold text-amber">Stage is not free.</strong> It settles in real mainnet USDC. The minimum
            bounty is 1.00, and a create and refund cycle costs about a cent.
          </span>
        </p>
      }
    >
      <ol className="flex flex-col gap-5">
        {STEPS.map((step, index) => (
          <li key={step.title} className="grid gap-3 sm:grid-cols-[2.25rem_minmax(0,1fr)]">
            <span className="flex size-7 items-center justify-center bg-amber text-[13px] font-bold text-bg">{index + 1}</span>
            <div className="min-w-0">
              <h2 className="mb-2.5 pt-0.5 text-[14px] font-bold">{step.title}</h2>
              {step.panel}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-[12.5px] text-dim sm:pl-[3rem]">
        The full walkthrough is in the{" "}
        <a href={`${REPO_URL}#getting-started`} className="text-amber underline underline-offset-4">
          README
        </a>
        .
      </p>
    </Stage>
  );
}
