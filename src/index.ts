#!/usr/bin/env node
import { Command } from 'commander';
import { planCommand } from './commands/plan';
import { applyCommand } from './commands/apply';
import { importCommand } from './commands/import';
import { statusCommand } from './commands/status';

const DEFAULT_FILE = 'bounties.yaml';

const program = new Command();

program
  .name('gibwork-sync')
  .description(
    'Declarative bounty management for Gibwork. Edit bounties.yaml, ' +
      'then plan/apply to reconcile it with the live platform.',
  )
  .version('0.1.0');

program
  .command('plan')
  .description('Preview changes: diff bounties.yaml against live Gibwork state (read-only)')
  .option('-f, --file <path>', 'path to the bounties file', DEFAULT_FILE)
  .action(async (opts) => {
    await planCommand({ file: opts.file });
  });

program
  .command('apply')
  .description('Reconcile Gibwork with bounties.yaml: create, update, and refund as needed')
  .option('-f, --file <path>', 'path to the bounties file', DEFAULT_FILE)
  .option('-y, --yes', 'skip interactive confirmation (for CI)', false)
  .action(async (opts) => {
    await applyCommand({ file: opts.file, yes: opts.yes });
  });

program
  .command('import')
  .description("Generate bounties.yaml from this wallet's existing live tasks")
  .option('-f, --file <path>', 'path to write the bounties file', DEFAULT_FILE)
  .action(async (opts) => {
    await importCommand({ file: opts.file });
  });

program
  .command('status')
  .description('Check for any unresolved apply operations before running again')
  .option('-f, --file <path>', 'path to the bounties file', DEFAULT_FILE)
  .action(async (opts) => {
    await statusCommand({ file: opts.file });
  });

program.parse();