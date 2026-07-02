export interface SessionInfo {
    session: string;
    cli: string;
    state: string;
    lastActivity: string;
    lastActivityAgo: string;
    eventCount: number;
    logFile: string;
    tmuxAlive: boolean;
}
export declare function discoverSessions(runDir?: string): SessionInfo[];
