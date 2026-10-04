"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { REPO_URL, TABS, VERSION, tabIndex } from "@/lib/site";
import { GitHubIcon, Wordmark } from "./logo";

/**
 * The tab bar reads as a command line: `$ gibbon` followed by the CLI's own
 * subcommands. Picking a tab is running that command.
 */
export function TopBar() {
  const active = tabIndex(usePathname());

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-sm">
      <div className="wrap flex h-14 items-center justify-between gap-4">
        <Link href="/" aria-label="Gibbon overview">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-2 text-[13px]">
          <a
            href={REPO_URL}
            className="flex items-center gap-2 border border-line px-3 py-1.5 text-dim transition-colors hover:border-edge hover:text-text"
          >
            <GitHubIcon className="size-4" />
            <span className="hidden sm:inline">source</span>
          </a>
          <Link
            href="/install"
            className="bg-amber px-3.5 py-1.5 font-bold text-bg transition-colors hover:bg-[#ffc45a]"
          >
            install
          </Link>
        </div>
      </div>

      <nav aria-label="Tabs" className="border-t border-line">
        <div className="wrap flex items-stretch overflow-x-auto px-0! [scrollbar-width:none] md:px-8!">
          {TABS.map((tab, index) => {
            const current = index === active;
            const startsGroup = index > 0 && TABS[index - 1]!.group !== tab.group;
            return (
              <div key={tab.href} className="flex shrink-0 items-stretch">
                {startsGroup && tab.group === "command" && (
                  <span aria-hidden="true" className="flex items-center border-l border-line pr-1 pl-4 text-[13px] text-faint select-none">
                    $ gibbon
                  </span>
                )}
                <Link
                  href={tab.href}
                  aria-current={current ? "page" : undefined}
                  className={`relative flex h-11 items-center gap-2 border-l border-line px-3.5 text-[13.5px] transition-colors last:border-r ${
                    current ? "bg-raised font-bold text-amber" : "text-dim hover:bg-panel hover:text-text"
                  }`}
                >
                  <span className={`text-[11px] font-normal ${current ? "text-amber/70" : "text-faint"}`}>{index + 1}</span>
                  {tab.label}
                  {current && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-amber" />}
                </Link>
              </div>
            );
          })}
        </div>
      </nav>
    </header>
  );
}

const KEY = "border border-edge px-1.5 text-[11px] leading-[1.5] text-text";

/** The line at the bottom of a terminal app: where you are and which keys work. */
export function StatusLine() {
  const active = tabIndex(usePathname());
  const tab = TABS[active]!;

  return (
    <footer className="sticky bottom-0 z-40 border-t border-line bg-panel text-[12px] text-dim">
      <div className="wrap flex h-8 items-center justify-between gap-4">
        <span className="flex min-w-0 items-center gap-3">
          <span className="bg-amber px-1.5 font-bold text-bg">
            {active + 1}/{TABS.length}
          </span>
          <span className="truncate">{tab.group === "command" ? `gibbon ${tab.label}` : tab.label}</span>
          <span className="hidden text-faint sm:inline">v{VERSION}</span>
        </span>
        <span className="hidden items-center gap-2 md:flex">
          <kbd className={KEY}>1</kbd>
          <span aria-hidden="true">to</span>
          <kbd className={KEY}>9</kbd>
          <span>jump</span>
          <kbd className={`${KEY} ml-3`}>&larr;</kbd>
          <kbd className={KEY}>&rarr;</kbd>
          <span>switch</span>
        </span>
        <span className="shrink-0 text-faint">
          <span className="hidden lg:inline">MIT. A community tool, </span>not an official Gibwork product
        </span>
      </div>
    </footer>
  );
}

/** Number keys jump to a tab; the arrow keys step through them. */
export function KeyNav() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable], [data-own-arrows]")) return;

      const active = tabIndex(pathname);
      let next: number | undefined;
      if (/^[1-9]$/.test(event.key)) next = Number(event.key) - 1;
      else if (event.key === "ArrowRight") next = active + 1;
      else if (event.key === "ArrowLeft") next = active - 1;

      const tab = next === undefined ? undefined : TABS[next];
      if (!tab || next === active) return;
      event.preventDefault();
      router.push(tab.href);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, pathname]);

  return null;
}
