export interface ApplyOptions {
    file: string;
    yes?: boolean; // skip interactive confirmation, for CI use
  }
  
  /**
   * Computes the same diff as `plan`, then executes it:
   * tasks.create / tasks.update / tasks.refund for each change.
   * Writes results back to .gibwork/state.json as it goes, so a
   * partial run leaves an accurate record of what succeeded.
   *
   * TODO: implement — will call src/lib/diff.ts + src/lib/gibworkClient.ts
   */
  export async function applyCommand(options: ApplyOptions): Promise<void> {
    //implement apply logic
    console.log(`[apply] would reconcile ${options.file} with Gibwork`);

  }