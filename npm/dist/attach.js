import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const PLUK_DEFAULT_RUN_DIR = '/tmp/pluk-run';
const CLI_STARTUP_WAIT_MS = 1500;
function tmuxExists(session) {
    try {
        execSync(`tmux has-session -t ${session} 2>/dev/null`, { stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
}
function tmuxIsAttached(session) {
    try {
        const result = execSync(`tmux list-sessions -F '#{session_name}:#{session_attached}' 2>/dev/null`, {
            encoding: 'utf-8',
        });
        for (const line of result.trim().split('\n')) {
            const [name, attached] = line.split(':');
            if (name === session && attached !== '0')
                return true;
        }
        return false;
    }
    catch {
        return false;
    }
}
function resolveCliCommand(cli) {
    const CLI_COMMANDS = {
        claude: 'claude',
        copilot: 'gh copilot',
        gemini: 'gemini',
        goose: 'goose session',
        codex: 'codex',
        aider: 'aider',
    };
    return CLI_COMMANDS[cli] ?? cli;
}
function resolveDangerousFlag(cli) {
    const DANGEROUS_FLAGS = {
        claude: '--dangerously-skip-permissions',
        codex: '--full-auto',
        goose: '--non-interactive',
    };
    return DANGEROUS_FLAGS[cli] ?? '';
}
function resolvePlukBin() {
    try {
        const path = execSync('which pluk 2>/dev/null || which pluk-classify 2>/dev/null', {
            encoding: 'utf-8',
        }).trim();
        return path;
    }
    catch {
        // fall back to npx
    }
    try {
        execSync('npx --yes @kubestellar/pluk version 2>/dev/null', { stdio: 'ignore' });
        return 'npx --yes @kubestellar/pluk';
    }
    catch {
        // not available
    }
    return '';
}
function resolveRationguardBin() {
    try {
        return execSync('which rationguard 2>/dev/null', { encoding: 'utf-8' }).trim();
    }
    catch {
        return 'npx --yes @kubestellar/rationguard';
    }
}
function detectTerminal() {
    const termProgram = process.env['TERM_PROGRAM'] ?? '';
    if (termProgram === 'iTerm.app')
        return 'iterm2';
    if (termProgram === 'Apple_Terminal')
        return 'terminal';
    if (process.platform === 'darwin')
        return 'terminal';
    return 'unknown';
}
function resolveTmuxPath() {
    try {
        return execSync('which tmux', { encoding: 'utf-8' }).trim();
    }
    catch {
        return 'tmux';
    }
}
function openTmuxInNewWindow(session) {
    const terminal = detectTerminal();
    const tmuxBin = resolveTmuxPath();
    switch (terminal) {
        case 'iterm2':
            try {
                execSync(`osascript -e 'tell application "iTerm2" to create window with default profile command "${tmuxBin} attach -t ${session}"'`, { stdio: 'ignore' });
                console.log(`Opened iTerm2 window attached to tmux session: ${session}`);
                return;
            }
            catch {
                // fall through
            }
            break;
        case 'terminal':
            try {
                execSync(`osascript -e 'tell application "Terminal" to do script "${tmuxBin} attach -t ${session}"'`, { stdio: 'ignore' });
                console.log(`Opened Terminal window attached to tmux session: ${session}`);
                return;
            }
            catch {
                // fall through
            }
            break;
    }
    console.log(`To interact with the agent: tmux attach -t ${session}`);
}
export function attach(opts) {
    const session = opts.session;
    const cli = opts.cli ?? 'claude';
    const cliCmd = opts.cliCommand ?? resolveCliCommand(cli);
    const runDir = opts.runDir ?? process.env['PLUK_RUN_DIR'] ?? PLUK_DEFAULT_RUN_DIR;
    const workDir = opts.workDir ?? process.cwd();
    const verbose = opts.verbose ?? false;
    const log = verbose
        ? (msg) => console.log(`${ANSI_DIM}[pluk]${ANSI_RESET} ${msg}`)
        : (_msg) => { };
    log(`session=${session} cli=${cli} runDir=${runDir} workDir=${workDir}`);
    const logsDir = join(runDir, 'logs');
    if (!existsSync(logsDir)) {
        log(`Creating logs directory: ${logsDir}`);
        mkdirSync(logsDir, { recursive: true });
    }
    const sessionExists = tmuxExists(session);
    log(`tmux session "${session}" exists: ${sessionExists}`);
    if (!sessionExists) {
        console.log(`Creating tmux session: ${session}`);
        const tmuxCmd = `tmux new-session -d -s ${session} -c "${workDir}"`;
        log(`exec: ${tmuxCmd}`);
        execSync(tmuxCmd, { stdio: 'inherit' });
        let fullCmd = cliCmd;
        if (opts.cliArgs) {
            fullCmd += ` ${opts.cliArgs}`;
        }
        if (opts.dangerouslySkipPermissions) {
            const dangerFlag = resolveDangerousFlag(cli);
            if (dangerFlag) {
                fullCmd += ` ${dangerFlag}`;
            }
            else {
                log(`no dangerous/auto flag known for cli=${cli}, skipping`);
            }
        }
        console.log(`Starting ${cli}: ${fullCmd}`);
        const sendCmd = `tmux send-keys -t ${session} "${fullCmd}" Enter`;
        log(`exec: ${sendCmd}`);
        execSync(sendCmd, { stdio: 'inherit' });
    }
    else {
        console.log(`Attaching to existing tmux session: ${session}`);
    }
    const plukBin = resolvePlukBin();
    log(`pluk binary: ${plukBin || '(not found)'}`);
    const includeRawFlag = opts.noRaw ? '' : ' --include-raw';
    const logFile = join(logsDir, `${session}.jsonl`);
    log(`log file: ${logFile}`);
    if (plukBin) {
        const pipeCmd = `PLUK_RUN_DIR=${runDir} ${plukBin} watch ${session} --cli=${cli}${includeRawFlag} >> ${logFile}`;
        log(`pipe-pane command: ${pipeCmd}`);
        console.log(`Attaching pluk pipe-pane: ${cli}`);
        const tmuxPipeCmd = `tmux pipe-pane -t ${session} -o "${pipeCmd}"`;
        log(`exec: ${tmuxPipeCmd}`);
        execSync(tmuxPipeCmd, { stdio: 'inherit' });
        log('pipe-pane attached successfully');
    }
    else {
        console.log('Warning: pluk binary not found, skipping pipe-pane attachment');
        console.log('Install globally: npm install -g @kubestellar/pluk');
    }
    console.log(`Pluk logs: ${logFile}`);
    if (opts.rationguard) {
        const alreadyAttached = tmuxIsAttached(session);
        if (!opts.noOpen && !alreadyAttached) {
            const tmuxBin = resolveTmuxPath();
            log(`opening terminal window (tmux=${tmuxBin}, terminal=${detectTerminal()})`);
            openTmuxInNewWindow(session);
        }
        else if (alreadyAttached) {
            log('skipping terminal window (session already attached)');
        }
        else {
            log('skipping terminal window (--no-open)');
        }
        const rgBin = resolveRationguardBin();
        log(`rationguard binary: ${rgBin}`);
        const rebuttalFlag = opts.rebuttal ? ` --rebuttal=${opts.rebuttal}` : '';
        const verboseFlag = verbose ? ' --verbose' : '';
        const rgCmd = `${rgBin} watch ${session} --run-dir=${runDir} --cli=${cli}${rebuttalFlag}${verboseFlag}`;
        log(`rationguard command: ${rgCmd}`);
        console.log(`Starting rationguard watcher in this terminal...`);
        console.log(`Detections will appear here. Ctrl+C to stop.\n`);
        const child = spawn('sh', ['-c', rgCmd], {
            stdio: 'inherit',
            detached: false,
        });
        process.on('SIGINT', () => {
            child.kill();
            process.exit(0);
        });
    }
    else {
        if (!opts.noOpen) {
            console.log(`\nAttaching to tmux session...`);
            try {
                execSync(`tmux attach -t ${session}`, { stdio: 'inherit' });
            }
            catch {
                console.log(`Session detached. To reattach: tmux attach -t ${session}`);
            }
        }
        else {
            console.log(`\nSession ready. To interact: tmux attach -t ${session}`);
            console.log(`To monitor: pluk subscribe ${session} --run-dir=${runDir}`);
        }
    }
}
const ANSI_DIM = '\x1b[2m';
const ANSI_RESET = '\x1b[0m';
