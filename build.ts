/*
 * Compiles src/ into dist/. Run it with `bun run build`.
 *
 * This is a file, not a "build" script in package.json, on purpose. When a
 * package installed from GitHub has a `build` or `prepare` script, npm builds
 * it during install, and for a global install (`npm i -g github:...`) that
 * step runs before the dependencies exist and fails. So package.json has
 * neither script, and dist/ is committed: after changing src/, run this and
 * commit dist/ with it.
 */
import { chmodSync } from "node:fs";
import { join } from "node:path";

const tsc = Bun.spawnSync([process.execPath, "x", "tsc"], {
  cwd: import.meta.dir,
  stdio: ["inherit", "inherit", "inherit"],
});

/* The CLI entry is run directly when the package is linked, so it has to stay
   executable. tsc does not set that on a freshly created file. */
if (tsc.exitCode === 0) chmodSync(join(import.meta.dir, "dist", "index.js"), 0o755);

process.exit(tsc.exitCode);
