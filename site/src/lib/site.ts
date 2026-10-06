/** The GitHub repository. Every link and install command on the site comes from these two. */
export const REPO_URL = "https://github.com/Shiva953/gibbon";
export const INSTALL_COMMAND = "npm i -g github:Shiva953/gibbon";

/** Where the site is served. Used for absolute URLs in link previews. */
export const SITE_URL = "https://gibbon-cli.vercel.app";

export const VERSION = "0.1.0";

/**
 * The site's tabs, in order. The five in the `command` group are the CLI's
 * own subcommands, so the tab bar reads as `$ gibbon <tab>`.
 */
export const TABS = [
  { href: "/", label: "overview", group: "home" },
  { href: "/plan", label: "plan", group: "command" },
  { href: "/apply", label: "apply", group: "command" },
  { href: "/status", label: "status", group: "command" },
  { href: "/import", label: "import", group: "command" },
  { href: "/agent", label: "agent", group: "command" },
  { href: "/ci", label: "ci", group: "more" },
  { href: "/internals", label: "internals", group: "more" },
  { href: "/install", label: "install", group: "more" },
] as const;

export type TabHref = (typeof TABS)[number]["href"];

export function tabIndex(pathname: string): number {
  const index = TABS.findIndex((tab) => tab.href === pathname);
  return index === -1 ? 0 : index;
}
