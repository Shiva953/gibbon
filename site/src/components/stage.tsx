import Link from "next/link";
import type { ReactNode } from "react";
import { TABS, type TabHref } from "@/lib/site";
import { SpotArt, type SpotKind } from "./art/spot-art";

const TONE = { leaf: "bg-leaf", sky: "bg-sky", lychee: "bg-lychee", amber: "bg-amber" } as const;

export interface Fact {
  tone: keyof typeof TONE;
  text: string;
}

interface StageProps {
  href: TabHref;
  /** The command this tab is about, shown as a prompt above the headline. */
  command?: string;
  title: string;
  lede: ReactNode;
  facts?: Fact[];
  /** Controls that sit under the copy: a scenario switch, a copy button. */
  controls?: ReactNode;
  /** A small illustration under the copy. Shown beside wide layouts only. */
  spot?: SpotKind;
  /** `split` puts the graphic beside the copy; `stack` puts it underneath, full width. */
  layout?: "split" | "stack";
  children: ReactNode;
}

/** One tab's screen: a headline, one sentence, and a graphic. */
export function Stage({ href, command, title, lede, facts, controls, spot, layout = "split", children }: StageProps) {
  const prompt = command && (
    <p className="mb-4 text-[13.5px] text-dim">
      <span className="text-amber">$</span> {command}
    </p>
  );
  const heading = (
    <h1 className="text-[clamp(1.85rem,3.4vw,2.75rem)] leading-[1.08] font-extrabold tracking-[-0.05em] text-balance">{title}</h1>
  );
  const body = (
    <>
      <p className="max-w-[30rem] text-[15px] leading-[1.7] text-dim">{lede}</p>
      {facts && (
        <ul className="mt-6 flex flex-wrap gap-2 text-[12.5px]">
          {facts.map((fact) => (
            <li key={fact.text} className="flex items-center gap-2 border border-line bg-panel px-2.5 py-1.5">
              <span aria-hidden="true" className={`size-2 ${TONE[fact.tone]}`} />
              {fact.text}
            </li>
          ))}
        </ul>
      )}
      {controls && <div className="mt-7">{controls}</div>}
    </>
  );

  const copy =
    layout === "split" ? (
      <div className="lg:sticky lg:top-36">
        {prompt}
        {heading}
        <div className="mt-5">{body}</div>
        {spot && <SpotArt kind={spot} className="mt-9 hidden w-full max-w-[22rem] lg:block" />}
      </div>
    ) : (
      <div className="grid gap-x-12 gap-y-5 lg:grid-cols-2">
        <div>
          {prompt}
          {heading}
        </div>
        <div className={command ? "lg:pt-9" : ""}>{body}</div>
      </div>
    );

  return (
    <main className="enter flex-1">
      <div
        className={`wrap pt-9 pb-8 lg:pt-12 ${
          layout === "split" ? "grid items-start gap-9 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-12" : "flex flex-col gap-9"
        }`}
      >
        {copy}
        <div className="min-w-0">{children}</div>
      </div>
      <Pager href={href} />
    </main>
  );
}

const KEY = "border border-edge px-1.5 text-[11px] leading-[1.6] text-dim";

/** Previous and next tab, so the end of one screen always points at another. */
export function Pager({ href }: { href: TabHref }) {
  const index = TABS.findIndex((tab) => tab.href === href);
  const prev = TABS[index - 1];
  const next = TABS[index + 1];

  return (
    <nav aria-label="Previous and next tab" className="wrap flex items-stretch justify-between gap-3 pb-10 text-[13.5px]">
      {prev ? (
        <Link href={prev.href} className="flex items-center gap-3 border border-line px-4 py-3 text-dim transition-colors hover:border-edge hover:text-text">
          <kbd className={KEY}>&larr;</kbd>
          {prev.label}
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link
          href={next.href}
          className="flex items-center gap-3 border border-amber/50 bg-amber/10 px-4 py-3 font-bold text-amber transition-colors hover:bg-amber/20"
        >
          <span className="font-normal text-dim">next</span>
          {next.label}
          <kbd className={`${KEY} border-amber/50 text-amber`}>&rarr;</kbd>
        </Link>
      )}
    </nav>
  );
}
