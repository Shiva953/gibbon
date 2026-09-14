export interface PlanOptions {
    file: string;
  }
  
  /**
   * Read-only: compares bounties.yaml against live Gibwork state
   * (tasks.list / tasks.get) and prints the diff. Makes no writes.
   *
   * TODO: implement diff logic — see src/lib/diff.ts (next step).
   */
  export async function planCommand(options: PlanOptions): Promise<void> {
    //implement plan logic
    console.log(`[plan] would diff ${options.file} against live Gibwork state`);

  }