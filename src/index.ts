#!/usr/bin/env node
import { Command, CommanderError, InvalidArgumentError } from 'commander';
import { EXIT, normalizeError } from './lib/errors.js';
import { createRuntime } from './runtime.js';
import { registerSync } from './sync.js';
import type { Environment } from './types.js';

const VERSION = '0.1.0';

interface GlobalOptions {
  profile?: string;
  environment?: Environment;
  apiUrl?: string;
  timeout?: number;
  keypair?: string;
  privateKeyStdin?: boolean;
  allowInsecureHttp?: boolean;
  json?: boolean;
  quiet?: boolean;
}

function parseEnvironment(value: string): Environment {
  if (value === 'stage' || value === 'production') return value;
  throw new InvalidArgumentError("Environment must be either 'stage' or 'production'.");
}

function parseTimeout(value: string): number {
  const ms = Number(value);
  if (!Number.isInteger(ms) || ms <= 0) {
    throw new InvalidArgumentError('Timeout must be a positive whole number of milliseconds.');
  }
  return ms;
}

const program = new Command();

program
  .name('gibbon')
  .description(
    'Bounties as code for Gibwork. Edit bounties.yaml, then plan/apply ' +
      'to reconcile it with the live platform.',
  )
  .version(VERSION)
  /* Spelled exactly as @gibwork/cli spells them, and resolved flag -> env ->
     profile -> default, so a wallet configured with `gibwork config set` works
     here untouched. A raw private key is never accepted as an argument. */
  .option('--profile <name>', 'configuration profile')
  .option('--environment <environment>', 'Gibwork API environment', parseEnvironment)
  .option('--api-url <url>', 'override the Gibwork SDK API URL')
  .option('--timeout <milliseconds>', 'request timeout in milliseconds', parseTimeout)
  .option('--keypair <path>', 'read a private key from an owner-only file')
  .option('--private-key-stdin', 'read a private key from piped stdin; never from an argument')
  .option('--json', 'emit stable JSON on stdout')
  .option('--quiet', 'suppress progress messages')
  .option('--no-color', 'disable color output')
  .option('--allow-insecure-http', 'allow a non-loopback API URL to use plain HTTP')
  /* Shorthands the official CLI does not define. */
  .option('-e, --env <environment>', 'alias for --environment', parseEnvironment)
  .option('-k, --keypair-file <path>', 'alias for --keypair');

/* Ctrl-C aborts in-flight work rather than killing the process mid-operation.
   State is written before anything is signed, so an abort is recoverable. */
const controller = new AbortController();
let cancelling = false;
process.on('SIGINT', () => {
  if (cancelling) process.exit(EXIT.CANCELLED);
  cancelling = true;
  controller.abort();
  process.stderr.write('\nCancelling… press Ctrl-C again to force.\n');
});

/* Must precede registerSync: commander copies _exitCallback into subcommands
   as they are created, so overriding later would leave them calling
   process.exit() directly with the wrong code. */
program.exitOverride();

registerSync(program, async () => {
  const opts = program.opts<GlobalOptions & { env?: Environment; keypairFile?: string }>();
  const keypair = opts.keypair ?? opts.keypairFile;
  const environment = opts.environment ?? opts.env;

  return createRuntime({
    ...(keypair ? { keypair } : {}),
    ...(opts.privateKeyStdin ? { privateKeyStdin: true } : {}),
    ...(opts.profile ? { profile: opts.profile } : {}),
    ...(environment ? { environment } : {}),
    ...(opts.apiUrl ? { apiUrl: opts.apiUrl } : {}),
    ...(opts.timeout ? { timeout: opts.timeout } : {}),
    ...(opts.allowInsecureHttp ? { allowInsecureHttp: true } : {}),
    json: opts.json ?? false,
    quiet: opts.quiet ?? false,
    signal: controller.signal,
  });
});

/** Turns any thrown value into the exit code @gibwork/cli uses for it. */
async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      // --help and --version succeed; everything else is a usage error.
      process.exitCode = error.exitCode === 0 ? EXIT.OK : EXIT.USAGE;
      return;
    }

    if (cancelling) {
      process.exitCode = EXIT.CANCELLED;
      return;
    }

    const { code, exitCode, message } = normalizeError(error);
    const json = process.argv.includes('--json');
    process.stderr.write(
      json
        ? `${JSON.stringify({ ok: false, error: { code, message } })}\n`
        : `\ngibbon [${code}]: ${message}\n`,
    );
    process.exitCode = exitCode;
  }
}

await main();
