"use client";

import { useState } from "react";

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard is unavailable (insecure origin, denied permission). The
      // command is still selectable text, so there is nothing to recover.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className="shrink-0 cursor-pointer border border-edge px-2.5 py-1 text-[12px] text-dim transition-colors hover:border-amber hover:text-amber"
    >
      <span aria-live="polite">{copied ? "copied" : "copy"}</span>
    </button>
  );
}

/** A command on one line, with a copy button. */
export function Command({ children, label }: { children: string; label: string }) {
  return (
    <div className="flex max-w-full min-w-0 items-center gap-3 border border-line bg-panel py-1.5 pr-1.5 pl-3.5 text-[13px]">
      <span aria-hidden="true" className="text-amber select-none">
        $
      </span>
      <code className="min-w-0 flex-1 truncate">{children}</code>
      <CopyButton text={children} label={label} />
    </div>
  );
}
