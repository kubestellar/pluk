import { type PlukEvent, type PlukEventType, createEvent } from './event.js';
import { type PatternSet } from './patterns.js';

const STATE_DEBOUNCE_SECONDS = 2;
const TRUNCATE_MAX_RUNES = 120;

const ANSI_RE = /\x1b\[\??[0-9;]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b[()][0-9A-B]|\x0f|\x1b=|\x1b>/g;

export function stripANSI(line: string): string {
  return line.replace(ANSI_RE, '').trim();
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

const TOOL_PAREN_RE = /\(([a-z]+)\)$/;
const TOOL_BULLET_RE = /[●✓]\s+([A-Za-z]+)/;

function extractTool(line: string): string {
  const parenMatch = TOOL_PAREN_RE.exec(line);
  if (parenMatch) return parenMatch[1];
  const bulletMatch = TOOL_BULLET_RE.exec(line);
  if (bulletMatch) return bulletMatch[1];
  return 'unknown';
}

const DURATION_RE = /\(([0-9.]+)s\)/;
const RESET_TIME_RE = /[0-9]{1,2}(:[0-9]{2})?\s*[aApP][mM]/;
const RESET_REL_RE = /in [0-9]+ (hour|minute|second)s?/;

function extractDuration(line: string): string {
  const m = DURATION_RE.exec(line);
  return m ? m[1] : '';
}

function extractResetTime(line: string): string {
  const abs = RESET_TIME_RE.exec(line);
  if (abs) return abs[0];
  const rel = RESET_REL_RE.exec(line);
  if (rel) return rel[0];
  return '';
}

export interface ClassifierOptions {
  session: string;
  pane?: string;
  source?: string;
  patterns: PatternSet;
}

export class Classifier {
  private patterns: PatternSet;
  private session: string;
  private pane: string;
  private source: string;
  private seq = 0;
  private currentState = 'unknown';
  private stateChangeTS = 0;

  constructor(opts: ClassifierOptions) {
    this.patterns = opts.patterns;
    this.session = opts.session;
    this.pane = opts.pane ?? '0';
    this.source = opts.source ?? 'pipe-pane';
  }

  classify(line: string): PlukEvent | null {
    if (!line) return null;

    const now = Math.floor(Date.now() / 1000);

    const checks: Array<[RegExp | null, PlukEventType, () => Record<string, string>]> = [
      [this.patterns.rateLimit, 'rate_limit', () => ({
        cli: this.patterns.cli, message: line, resets_at: extractResetTime(line),
      })],
      [this.patterns.login, 'login_required', () => ({
        cli: this.patterns.cli, prompt: line,
      })],
      [this.patterns.trustDialog, 'trust_dialog', () => ({
        prompt: line, auto_approved: 'false',
      })],
      [this.patterns.bypass, 'bypass_permissions', () => ({
        prompt: line, auto_approved: 'false',
      })],
      [this.patterns.toolStart, 'tool_call_started', () => ({
        tool: extractTool(line), input_preview: truncate(line, TRUNCATE_MAX_RUNES),
      })],
      [this.patterns.toolEnd, 'tool_call_completed', () => ({
        tool: extractTool(line), duration_ms: extractDuration(line),
      })],
      [this.patterns.error, 'error', () => ({
        message: line, severity: 'error',
      })],
      [this.patterns.model, 'model_changed', () => ({
        from: '', to: line,
      })],
      [this.patterns.sessionEnd, 'session_ended', () => ({
        cli: this.patterns.cli,
      })],
    ];

    for (const [re, type, dataFn] of checks) {
      if (re && re.test(line)) {
        this.seq++;
        return createEvent(this.session, this.pane, this.source, this.seq, type, dataFn());
      }
    }

    let newState = '';
    if (this.patterns.idle?.test(line)) {
      newState = 'idle';
    } else if (this.patterns.working?.test(line)) {
      newState = 'working';
    }

    if (newState && newState !== this.currentState) {
      const elapsed = now - this.stateChangeTS;
      if (elapsed >= STATE_DEBOUNCE_SECONDS) {
        const oldState = this.currentState;
        this.currentState = newState;
        this.stateChangeTS = now;
        this.seq++;
        return createEvent(this.session, this.pane, this.source, this.seq, 'state_change', {
          from: oldState, to: newState,
        });
      }
    }

    return null;
  }

  rawOutput(line: string): PlukEvent {
    this.seq++;
    return createEvent(this.session, this.pane, this.source, this.seq, 'raw_output', { line });
  }

  commandReceived(text: string, sender: string): PlukEvent {
    this.seq = 1000001;
    return createEvent(this.session, this.pane, this.source, this.seq, 'command_received', { text, sender });
  }
}
