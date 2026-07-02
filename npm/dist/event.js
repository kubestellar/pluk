const EVENT_VERSION = 1;
export function createEvent(session, pane, source, seq, type, data) {
    return {
        v: EVENT_VERSION,
        ts: new Date().toISOString().replace(/(\.\d{3})\d*Z/, '$1Z'),
        seq,
        pid: process.pid,
        session,
        pane,
        source,
        type,
        data,
    };
}
export function parseEvent(line) {
    try {
        return JSON.parse(line);
    }
    catch {
        return null;
    }
}
