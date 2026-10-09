export interface AgentOptions {
    file: string;
    prompt: string;
    dryRun?: boolean;
    model?: string;
}
/**
 * Rewrites bounties.yaml from a natural-language request.
 *
 * The one command that needs no wallet: it reads local files, calls Claude and
 * writes a file — it never contacts Gibwork or signs anything. The model's
 * output is re-parsed with our own loader before it reaches disk.
 */
export declare function agentCommand(options: AgentOptions): Promise<void>;
//# sourceMappingURL=agent.d.ts.map