#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import { applyCommand } from './commands/apply.js';
import { importCommand } from './commands/import.js';
import { planCommand } from './commands/plan.js';
import { statusCommand } from './commands/status.js';
import type { Environment } from './types.js';

const DEFAULT_FILE = 'bounties.yaml';
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
     over between the two tools. */
  .option(
    '-e, --environment <environment>',
    'target environment: stage or production',
    parseEnvironment,
    'stage' as Environment,
  );

/** Global options live on the root command, so merge them into each action. */
function globals(): { keypair?: string; env: Environment } {
  const opts = program.opts<GlobalOptions>();
  return { ...(opts.keypair ? { keypair: opts.keypair } : {}), env: opts.environment };
}

program
  .command('plan')
  .description('Preview changes: diff bounties.yaml against live Gibwork state (read-only)')
  .option('-f, --file <path>', 'path to the bounties file', DEFAULT_FILE)
  .action(async (opts: { file: string }) => {
    await planCommand({ file: opts.file, ...globals() });
  });

program
  .command('apply')
  .description('Reconcile Gibwork with bounties.yaml: create, update, and refund as needed')
  .option('-f, --file <path>', 'path to the bounties file', DEFAULT_FILE)
  .option('-y, --yes', 'skip the interactive confirmation (for CI)', false)
  .action(async (opts: { file: string; yes: boolean }) => {
    await applyCommand({ file: opts.file, yes: opts.yes, ...globals() });
  });

program
  .command('import')
  .description("Generate bounties.yaml from this wallet's existing live tasks")
  .option('-f, --file <path>', 'path to write the bounties file', DEFAULT_FILE)
  .action(async (opts: { file: string }) => {
    await importCommand({ file: opts.file, ...globals() });
  });

program
  .command('status')
  .description('Resolve unresolved apply operations against live Gibwork state')
  .option('-f, --file <path>', 'path to the bounties file', DEFAULT_FILE)
  .option('--dry-run', 'report without rewriting .gibwork/state.json', false)
  .action(async (opts: { file: string; dryRun: boolean }) => {
    await statusCommand({ file: opts.file, dryRun: opts.dryRun, ...globals() });
  });

/**
 * One place to turn a thrown error into a clean exit. Commander's own errors
 * (--help, --version, bad flags) already handle their own exit codes.
 */
async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`\ngibwork-sync: ${message}\n`);
    process.exitCode = 1;
  }
}

await main();
