"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface Scenario {
  id: string;
  label: string;
  /** One line under the switch saying what this scenario shows. */
  caption: ReactNode;
  panel: ReactNode;
}

/**
 * Sub-tabs over a graphic. Only the chosen panel is mounted, so its terminal
 * replays each time it is picked.
 */
export function ScenarioSwitch({ label, items }: { label: string; items: Scenario[] }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = items[active]!;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (active + step + items.length) % items.length;
    setActive(next);
    tabs.current[next]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label={label} data-own-arrows className="flex overflow-x-auto text-[13px] [scrollbar-width:none]">
        {items.map((item, index) => {
          const selected = index === active;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`scenario-${item.id}`}
              aria-selected={selected}
              aria-controls="scenario-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              onKeyDown={onKeyDown}
              className={`-mr-px shrink-0 cursor-pointer border px-3.5 py-2 transition-colors ${
                selected
                  ? "relative z-10 border-amber bg-amber/10 font-bold text-amber"
                  : "border-line text-dim hover:border-edge hover:text-text"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="scenario-panel" aria-labelledby={`scenario-${current.id}`} tabIndex={0}>
        <p className="py-4 text-[13.5px] leading-relaxed text-dim">{current.caption}</p>
        <div key={current.id} className="flex flex-col gap-3">
          {current.panel}
        </div>
      </div>
    </div>
  );
}
