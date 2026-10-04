"use client";

import { useState, type ReactNode } from "react";

const STEPS = [
  { title: "prepare", detail: "Gibwork returns a UUID. Nothing is paid." },
  { title: "write to disk", detail: "The barrier. No signature exists yet." },
  { title: "sign", detail: "Locally, offline." },
  { title: "send", detail: "Money moves here." },
  { title: "mark done", detail: "Only when confirmed." },
];

const MARKER = (
  <>
    A pending marker with the UUID. The next <code className="ic">apply</code> exits 31.
  </>
);

/**
 * Where the process can die, and what `status` finds afterwards. The verdict
 * names are the ones resolveOperation() returns.
 */
const SCENARIOS: {
  label: string;
  /** How many of the five steps finished before the kill. */
  done: number;
  disk: ReactNode;
  gibwork: string;
  verdict: string;
  tone: "leaf" | "amber" | "plain";
  result: string;
}[] = [
  {
    label: "before the write",
    done: 1,
    disk: "Nothing. There was nothing to mark yet.",
    gibwork: "Prepared, never signed, never paid.",
    verdict: "clean",
    tone: "plain",
    result: "The next plan shows the create again.",
  },
  {
    label: "before send",
    done: 3,
    disk: MARKER,
    gibwork: "Not found. Prepared but never funded.",
    verdict: "never-landed",
    tone: "leaf",
    result: "Marker cleared. Safe to apply again.",
  },
  {
    label: "after send, still settling",
    done: 4,
    disk: MARKER,
    gibwork: "Still creating. Payment has not settled.",
    verdict: "in-flight",
    tone: "amber",
    result: "Apply stays blocked. Retrying now could pay twice.",
  },
  {
    label: "after send, payment landed",
    done: 4,
    disk: MARKER,
    gibwork: "Open. The bounty exists and is funded.",
    verdict: "succeeded",
    tone: "leaf",
    result: "Adopted. Exactly one bounty exists.",
  },
];

const VERDICT = {
  leaf: "bg-leaf text-bg",
  amber: "bg-amber text-bg",
  plain: "bg-edge text-text",
} as const;

function Bolt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className}>
      <path fill="currentColor" d="M9.4 0 2.5 9h4l-1 7 7-9.3H8.3L9.4 0Z" />
    </svg>
  );
}

export function PlugDemo({ children }: { children?: ReactNode }) {
  const [active, setActive] = useState(1);
  const scenario = SCENARIOS[active]!;

  return (
    <div>
      <ol className="grid gap-px border border-line bg-line sm:grid-cols-5">
        {STEPS.map((step, index) => {
          const done = index < scenario.done;
          const struck = index === scenario.done;
          return (
            <li key={step.title} className={`flex gap-3 p-4 sm:block ${struck ? "bg-lychee/10" : "bg-bg"}`}>
              <span
                className={`flex size-7 shrink-0 items-center justify-center text-[13px] font-bold transition-colors ${
                  done ? "bg-amber text-bg" : struck ? "bg-lychee text-bg" : "bg-raised text-faint"
                }`}
              >
                {struck ? <Bolt className="size-3.5" /> : index + 1}
              </span>
              <div className={`sm:mt-3 ${done || struck ? "" : "opacity-45"}`}>
                <p className={`text-[14px] font-bold ${struck ? "text-lychee" : ""}`}>
                  {step.title}
                  {struck && <span className="sr-only"> (killed here)</span>}
                </p>
                <p className="mt-1 text-[12.5px] leading-snug text-dim">{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="border border-line bg-panel p-5">
          <p id="kill-label" className="flex items-center gap-2 text-[13.5px] font-bold">
            <Bolt className="size-3.5 text-lychee" />
            kill -9
          </p>
          <div role="group" aria-labelledby="kill-label" data-own-arrows className="mt-3 flex flex-wrap gap-2">
            {SCENARIOS.map((option, index) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={index === active}
                onClick={() => setActive(index)}
                className={`cursor-pointer border px-3 py-1.5 text-[12.5px] transition-colors ${
                  index === active
                    ? "border-amber bg-amber/10 font-bold text-amber"
                    : "border-line text-dim hover:border-edge hover:text-text"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <dl aria-live="polite" className="mt-6 grid gap-4 text-[13.5px] leading-relaxed">
            <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3">
              <dt className="text-faint">on disk</dt>
              <dd>{scenario.disk}</dd>
            </div>
            <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3">
              <dt className="text-faint">gibwork says</dt>
              <dd>{scenario.gibwork}</dd>
            </div>
            <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 border-t border-line pt-4">
              <dt>
                <span className={`px-1.5 py-0.5 text-[12px] font-bold ${VERDICT[scenario.tone]}`}>{scenario.verdict}</span>
              </dt>
              <dd className="font-bold">{scenario.result}</dd>
            </div>
          </dl>
        </div>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
