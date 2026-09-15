import type { Runtime } from '../runtime.js';

export interface ImportOptions {
  file: string;
}

/**
 * Pulls existing tasks for the configured wallet (tasks.list + tasks.get) and
 * generates bounties.yaml + state.json, so an existing Gibwork creator can
 * adopt gibwork-sync without hand-transcribing their bounties.
 *
 * The acceptance check: immediately after import, `plan` must report zero
 * changes. If it does not, the round trip is lossy and the file cannot be
 * trusted as the source of truth yet.
 *
 * TODO: implement.
 */
export async function importCommand(runtime: Runtime, options: ImportOptions): Promise<void> {
  console.log(`[import] not yet implemented`);
  console.log(`         file:        ${options.file}`);
  console.log(`         environment: ${runtime.environment}`);
  console.log(`         would write live tasks into the file and seed state.json`);
}
