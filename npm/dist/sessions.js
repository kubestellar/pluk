import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { parseEvent } from './event.js';
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;
const MAX_TAIL_LINES = 100;
function readLastEvents(filePath, maxEvents) {
    const events = [];
    try {
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());
        const start = Math.max(0, lines.length - MAX_TAIL_LINES);
        for (let i = lines.length - 1; i >= start && events.length < maxEvents; i--) {
            const event = parseEvent(lines[i]);
            if (event)
                events.unshift(event);
        }
    }
    catch {
        // file unreadable
    }
    return events;
}
function formatAgo(isoTimestamp) {
    const diff = Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 1000);
    if (diff < 0)
        return 'just now';
    if (diff < SECONDS_PER_MINUTE)
        return `${diff}s ago`;
    if (diff < SECONDS_PER_HOUR)
        return `${Math.floor(diff / SECONDS_PER_MINUTE)}m ago`;
    if (diff < SECONDS_PER_DAY)
        return `${Math.floor(diff / SECONDS_PER_HOUR)}h ago`;
    return `${Math.floor(diff / SECONDS_PER_DAY)}d ago`;
}
function getTmuxSessions() {
    const sessions = new Set();
    try {
        const output = execSync('tmux list-sessions -F "#{session_name}" 2>/dev/null', {
            encoding: 'utf-8',
            timeout: 5000,
        });
        for (const line of output.split('\n')) {
            const name = line.trim();
            if (name)
                sessions.add(name);
        }
    }
    catch {
        // tmux not running or not installed
    }
    return sessions;
}
function countEvents(filePath) {
    try {
        const content = readFileSync(filePath, 'utf-8');
        return content.split('\n').filter(l => l.trim()).length;
    }
    catch {
        return 0;
    }
}
export function discoverSessions(runDir) {
    const dir = runDir ?? process.env['PLUK_RUN_DIR'] ?? '/var/run/pluk';
    const logsDir = join(dir, 'logs');
    let files;
    try {
        files = readdirSync(logsDir).filter(f => f.endsWith('.jsonl'));
    }
    catch {
        return [];
    }
    const tmuxSessions = getTmuxSessions();
    const results = [];
    const MAX_TAIL_EVENTS = 50;
    for (const file of files) {
        const session = file.replace('.jsonl', '');
        const filePath = join(logsDir, file);
        const events = readLastEvents(filePath, MAX_TAIL_EVENTS);
        if (events.length === 0)
            continue;
        let cli = 'unknown';
        let state = 'unknown';
        let lastTs = '';
        for (const e of events) {
            if (e.ts > lastTs)
                lastTs = e.ts;
            if (e.data['cli'] && e.data['cli'] !== 'unknown') {
                cli = e.data['cli'];
            }
            if (e.type === 'state_change') {
                state = e.data['to'] ?? 'unknown';
            }
        }
        results.push({
            session,
            cli,
            state,
            lastActivity: lastTs,
            lastActivityAgo: lastTs ? formatAgo(lastTs) : 'unknown',
            eventCount: countEvents(filePath),
            logFile: filePath,
            tmuxAlive: tmuxSessions.has(session),
        });
    }
    results.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
    return results;
}
