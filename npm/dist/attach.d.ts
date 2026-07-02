export interface AttachOptions {
    session: string;
    cli?: string;
    cliCommand?: string;
    cliArgs?: string;
    runDir?: string;
    rationguard?: boolean;
    rebuttal?: 'log' | 'send';
    noRaw?: boolean;
    workDir?: string;
    noOpen?: boolean;
    verbose?: boolean;
    dangerouslySkipPermissions?: boolean;
}
export declare function attach(opts: AttachOptions): void;
