export interface ImportOptions {
    file: string;
  }
  
  /**
   * Pulls existing tasks for the configured wallet (tasks.list) and
   * generates bounties.yaml + state.json from them, so an existing
   * Gibwork creator can adopt gibwork-sync without hand-transcribing
   * their current bounties.
   *
   * TODO: implement — after this, `plan` against the generated file
   * should show zero diff (the round-trip check).
   */
  export async function importCommand(options: ImportOptions): Promise<void> {
    //implement import logic
    console.log(`[import] would pull existing tasks into ${options.file}`);
  }