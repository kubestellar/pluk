import { execSync } from 'node:child_process';

export interface SendOptions {
  session: string;
  text: string;
  enter?: boolean;
  literal?: boolean;
}

export function send(opts: SendOptions): void {
  const { session, text, enter = false, literal = false } = opts;
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`')
    .replace(/!/g, '\\!');
  const literalFlag = literal ? ' -l' : '';

  if (literal || !enter) {
    execSync(`tmux send-keys${literalFlag} -t ${session} "${escaped}"${enter ? ' Enter' : ''}`, {
      stdio: 'pipe',
    });
  } else {
    execSync(`tmux send-keys -l -t ${session} "${escaped}"`, { stdio: 'pipe' });
    execSync(`tmux send-keys -t ${session} Enter`, { stdio: 'pipe' });
  }
}
