import Link from "next/link";
import { HeroArt } from "@/components/art/hero-art";
import { Command } from "@/components/copy-button";
import { Glyph, type GlyphKind } from "@/components/logo";
import { Pager } from "@/components/stage";
import { INSTALL_COMMAND } from "@/lib/site";

const MARKS: { kind: GlyphKind; label: string }[] = [
  { kind: "add", label: "create" },
  { kind: "upd", label: "update" },
  { kind: "del", label: "refund" },
  { kind: "warn", label: "blocked" },
];

/* The five commands, each with a line of its real output. */
const COMMANDS = [
  { href: "/plan", name: "plan", does: "Preview every change.", out: "+ create   docs-cli   1.00", tone: "text-leaf" },
  { href: "/apply", name: "apply", does: "Make it so, once.", out: "No changes.", tone: "text-text" },
  { href: "/status", name: "status", does: "Recover from a crash.", out: "v create   Adopted into state.", tone: "text-leaf" },
  { href: "/import", name: "import", does: "Adopt live bounties.", out: "Imported 2 bounty(s)", tone: "text-text" },
  { href: "/agent", name: "agent", does: "Edit in plain English.", out: "! amount is immutable", tone: "text-amber" },
] as const;

export default function Overview() {
  return (
    <main className="enter flex-1">
      <div className="wrap grid grid-cols-1 items-center gap-10 pt-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.18fr)] lg:gap-12 lg:pt-12">
        <div className="min-w-0">
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-dim">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2 bg-leaf" />
              92 tests passing
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2 bg-leaf" />
              run against live Gibwork stage
            </span>
          </p>

          <h1 className="mt-6 text-[clamp(2.7rem,6.2vw,4.9rem)] leading-[0.98] font-extrabold tracking-[-0.06em]">
            Bounties
            <br />
            as code<span className="cursor cursor-cap ml-[0.12em]" />
          </h1>

          <p className="mt-6 max-w-[31rem] text-[15.5px] leading-[1.7] text-dim">
            Keep your Gibwork bounties in a YAML file. Preview every change. Never pay twice.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:max-w-[31rem]">
            <Command label="Copy the install command">{INSTALL_COMMAND}</Command>
            <ul aria-label="What a plan can say" className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-dim">
              {MARKS.map((mark) => (
                <li key={mark.kind} className="flex items-center gap-2">
                  <Glyph kind={mark.kind} className="text-[12px]" />
                  {mark.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <figure className="border border-line bg-panel p-1.5">
          <HeroArt className="block w-full" />
        </figure>
      </div>

      <section aria-label="The five commands" className="wrap mt-10 pb-9 lg:mt-12">
        <ul className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-3 lg:grid-cols-5">
          {COMMANDS.map((command, index) => (
            <li key={command.name} className="bg-bg last:col-span-2 md:last:col-span-1">
              <Link href={command.href} className="group flex h-full flex-col gap-2 p-4 transition-colors hover:bg-raised">
                <span className="flex items-baseline justify-between">
                  <span className="text-[1.05rem] font-bold">
                    <span className="text-faint">gibbon </span>
                    <span className="group-hover:text-amber">{command.name}</span>
                  </span>
                  <span className="text-[11px] text-faint">{index + 2}</span>
                </span>
                <span className="text-[13px] text-dim">{command.does}</span>
                <span className={`mt-2 truncate border-t border-line pt-2.5 text-[11.5px] whitespace-pre ${command.tone}`}>{command.out}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Pager href="/" />
    </main>
  );
}
