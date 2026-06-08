# 🎸 Pluk

Pluk structured events from non-deterministic AI agent terminal output.

AI coding agents (Claude Code, GitHub Copilot CLI, Gemini CLI, Goose, etc.) produce rich but unstructured terminal output — spinners, tool calls, rate limit messages, login prompts, error states. This project captures that output via `tmux pipe-pane` and classifies it into a structured JSONL event stream that any system can subscribe to.

**Single compiled Go binary. No dependencies. 3.6MB.**

## Quick start

```bash
# Clone and build
git clone https://github.com/kubestellar/pluk.git
cd pluk
go build -o pluk ./cmd/pluk/

# Create symlinks for multi-call binary
ln -sf pluk pluk-publish
ln -sf pluk pluk-subscribe
ln -sf pluk pluk-send

# Or use make
make install
```

## Usage with a real AI agent

```bash
# 1. Start an AI agent in tmux
tmux new-session -d -s my-agent
tmux send-keys -t my-agent "claude" Enter

# 2. Attach pluk to capture output (set pattern dir to where you cloned)
tmux pipe-pane -t my-agent -o \
  "PLUK_RUN_DIR=/tmp/pluk-run \
   PLUK_PATTERNS_DIR=/path/to/pluk/config/patterns.d \
   /path/to/pluk-publish --session my-agent --cli claude"

# 3. Subscribe to events in real-time (another terminal)
PLUK_RUN_DIR=/tmp/pluk-run ./pluk subscribe my-agent

# 4. Subscribe with filter (only classified events, no raw output)
PLUK_RUN_DIR=/tmp/pluk-run ./pluk subscribe my-agent \
  --filter "state_change,tool_call_started,tool_call_completed,rate_limit,error"

# 5. Send commands to the agent
./pluk-send --session my-agent --text "what is 2+2?" --enter

# 6. Watch the agent work in tmux
tmux attach -t my-agent
```

**Three terminals:**
- **Terminal 1**: `tmux attach -t my-agent` — watch the agent work
- **Terminal 2**: `./pluk subscribe my-agent` — see classified events stream
- **Terminal 3**: `./pluk-send --session my-agent --text "..." --enter` — send commands

## Event types

| Type | Meaning | Example trigger |
|------|---------|-----------------|
| `raw_output` | Every non-empty line of terminal output | Any text |
| `state_change` | Agent went idle or started working | `❯` prompt, spinner chars |
| `rate_limit` | Usage limit / quota exhausted | "out of extra usage" |
| `login_required` | Authentication needed | Login URL in output |
| `trust_dialog` | Folder trust prompt | "Do you trust the files" |
| `bypass_permissions` | Permission bypass prompt | "bypass permissions on" |
| `tool_call_started` | Agent invoked a tool | `● Read`, `● Bash` |
| `tool_call_completed` | Tool finished | `✓ Read (0.1s)` |
| `error` | Error in output | "Error:", "panic:" |
| `model_changed` | Model was switched | Model name in output |
| `session_ended` | CLI session ended | "Session ended" |
| `command_received` | Command sent via pluk-send | Bidirectional input |

## Event schema

```json
{
  "v": 1,
  "ts": "2026-06-08T19:57:25.192Z",
  "seq": 42,
  "pid": 0,
  "session": "my-agent",
  "pane": "0",
  "source": "pipe-pane",
  "type": "tool_call_started",
  "data": {
    "tool": "Read",
    "input_preview": "● Read main.go"
  }
}
```

## Supported CLIs

Pattern files in `config/patterns.d/` define the regex patterns for each CLI:

- **Claude Code** (`claude.patterns`) — spinners, tool calls, rate limits, trust dialogs, bypass permissions
- **GitHub Copilot CLI** (`copilot.patterns`) — environment loaded, idle prompt, rate limits
- **Gemini CLI** (`gemini.patterns`) — thinking indicators, quota errors
- **Goose CLI** (`goose.patterns`) — processing indicators, rate limits

Adding a new CLI is a single pattern file — no code changes needed.

## Architecture

```
┌──────────────────┐    ┌────────────────┐    ┌────────────────┐
│  tmux session    │───▶│  pluk publish  │───▶│ session.jsonl  │
│  (any AI CLI)    │    │  (pipe-pane)   │    │ (append-only)  │
└──────────────────┘    └────────────────┘    └───────┬────────┘
                                                      │
                             ┌────────────────┐       │ tail -f
                             │ pluk subscribe │◀──────┘
                             │ (any number)   │
                             └────────────────┘

┌──────────────────┐    ┌────────────────┐
│  orchestrator    │───▶│   pluk send    │───▶ tmux send-keys
│  (watcher, etc.) │    │  (per-session) │
└──────────────────┘    └────────────────┘
```

- **Single Go binary** — `pluk publish`, `pluk subscribe`, `pluk send` subcommands
- **Multi-call binary** — symlinks `pluk-publish`, `pluk-subscribe`, `pluk-send` also work
- **No broker process** — log-based pub-sub using append-only JSONL files
- **Multiple subscribers** — any number of processes tailing the same file
- **Bidirectional** — `pluk send` delivers commands via tmux send-keys
- **Compiled regex** — pattern matching in Go, no perl dependency

## Docker / Container install

```dockerfile
# Build pluk from source in a container (requires Go)
RUN git clone --depth 1 https://github.com/kubestellar/pluk.git /tmp/pluk && \
    cd /tmp/pluk && go build -o /usr/local/bin/pluk ./cmd/pluk/ && \
    ln -sf pluk /usr/local/bin/pluk-publish && \
    ln -sf pluk /usr/local/bin/pluk-subscribe && \
    ln -sf pluk /usr/local/bin/pluk-send && \
    mkdir -p /usr/local/etc/pluk/patterns.d && \
    cp -r /tmp/pluk/config/patterns.d/* /usr/local/etc/pluk/patterns.d/ && \
    rm -rf /tmp/pluk && \
    mkdir -p /var/run/pluk/logs /var/run/pluk/commands && \
    chmod 1777 /var/run/pluk/logs /var/run/pluk/commands
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PLUK_RUN_DIR` | `/var/run/pluk` | Runtime directory for logs and commands |
| `PLUK_PATTERNS_DIR` | `/etc/pluk/patterns.d` | Pattern files directory |
| `PLUK_CONFIG_DIR` | `/etc/pluk` | Config root directory |

## Building from source

```bash
git clone https://github.com/kubestellar/pluk.git
cd pluk
go build -o pluk ./cmd/pluk/

# Verify
./pluk version
# pluk 2.0.0 (go)

# Test event classification
printf '● Read main.go\n✓ Read main.go (0.3s)\nout of extra usage\n❯ \n' | \
  PLUK_PATTERNS_DIR=./config/patterns.d \
  PLUK_RUN_DIR=/tmp/pluk-test \
  ./pluk publish --session test --cli claude --no-raw
cat /tmp/pluk-test/logs/test.jsonl
```

## Performance

- **10,000 lines in 0.15 seconds** (64K lines/sec)
- **3.6MB** single static binary
- Zero external dependencies

## License

Apache 2.0
