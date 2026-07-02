export interface PlukEvent {
    v: number;
    ts: string;
    seq: number;
    pid: number;
    session: string;
    pane: string;
    source: string;
    type: PlukEventType;
    data: Record<string, string>;
}
export type PlukEventType = 'raw_output' | 'state_change' | 'rate_limit' | 'login_required' | 'trust_dialog' | 'bypass_permissions' | 'tool_call_started' | 'tool_call_completed' | 'error' | 'model_changed' | 'session_ended' | 'command_received';
export declare function createEvent(session: string, pane: string, source: string, seq: number, type: PlukEventType, data: Record<string, string>): PlukEvent;
export declare function parseEvent(line: string): PlukEvent | null;
