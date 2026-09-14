export interface StatusOptions {
    file: string;
  }
  
  /**
   * Checks .gibwork/state.json for any entries whose last apply
   * attempt did not reach a confirmed final state (i.e. the
   * lightweight reconciliation-watchdog behavior folded into sync,
   * per the earlier design decision). Refuses to let `apply` run
   * again over an unresolved entry until this is clean.
   *
   * TODO: implement — will call submissions/tasks status reads.
   */
  export async function statusCommand(options: StatusOptions): Promise<void> {
    //implement status logic
    console.log(`[status] would check ${options.file} for unresolved operations`);

  }