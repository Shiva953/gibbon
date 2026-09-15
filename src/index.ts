#!/usr/bin/env node
import { Command, CommanderError, InvalidArgumentError } from 'commander';
import { EXIT, normalizeError } from './lib/errors.js';
import { createRuntime } from './runtime.js';
import { registerSync } from './sync.js';
import type { Environment } from './types.js';

const VERSION = '0.1.0';

interface GlobalOptions {
  keypair?: string;
  environment: Environment;
}

function parseEnvironment(value: string): Environment {
  if (value === 'stage' || value === 'production') return value;
  throw new InvalidArgumentError("Environment must be either 'stage' or 'production'.");
}

const program = new Command();

program
  .name('gibwork-sync')
  .description(
    'Declarative bounty management for Gibwork. Edit bounties.yaml, then plan/apply ' +
      'to reconcile it with the live platform.',
  )
  .version(VERSION)
  /* Credentials are global: every command that touches the network needs them.
     A raw private key is never accepted as an argument — only a file path or
     an environment variable. See src/lib/gibworkClient.ts. */
  .option('-k, --keypair <path>', 'path to a Solana keypair JSON file')
  /* Spelled the same as @gibwork/cli's --environment so muscle memory carries
     over. The short forms are standalone conveniences the official CLI does
     not define; they would be dropped if these commands were ever upstreamed. */
  .option(
    '-e, --environment <environment>',
    'target environment: stage or production',
    parseEnvironment,
    'stage' as Environment,
  );

/* Must precede registerSync: commander copies _exitCallback into subcommands
   when they are created, so overriding afterwards would leave them calling
   process.exit() directly and reporting the wrong code. */
program.exitOverride();

registerSync(program, async () => {
  const opts = program.opts<GlobalOptions>();
  return createRuntime({
    ...(opts.keypair ? { keypair: opts.keypair } : {}),
    environment: opts.environment,
  });
});

/**
 * One place to turn a thrown value into the exit code @gibwork/cli would use
 * for the same failure, so a CI script can treat both tools identically.
 */
async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      // --help and --version report success; everything else is a usage error.
      process.exitCode = error.exitCode === 0 ? EXIT.OK : EXIT.USAGE;
      return;
    }

    const { code, message } = normalizeError(error);
    process.stderr.write(`\ngibwork-sync [${code}]: ${message}\n`);
    process.exitCode = normalizeError(error).exitCode;
  }
}

await main();
