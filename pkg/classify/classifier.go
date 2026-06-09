package classify

import (
	"regexp"
	"strings"
	"time"

	"github.com/kubestellar/pluk/pkg/events"
)

const stateDebounceSeconds = 2

type Classifier struct {
	patterns       *Patterns
	session        string
	pane           string
	source         string
	seq            int
	currentState   string
	stateChangeTS  int64
}

func New(patterns *Patterns, session, pane, source string) *Classifier {
	return &Classifier{
		patterns:      patterns,
		session:       session,
		pane:          pane,
		source:        source,
		currentState:  "unknown",
		stateChangeTS: 0,
	}
}

func (c *Classifier) Classify(line string) *events.Event {
	if line == "" {
		return nil
	}

	now := time.Now().Unix()

	if e := c.matchPattern(c.patterns.RateLimit, line, "rate_limit", func() map[string]string {
		resetsAt := extractResetTime(line)
		return map[string]string{"cli": c.patterns.CLI, "message": line, "resets_at": resetsAt}
	}); e != nil {
		return e
	}

	if e := c.matchPattern(c.patterns.Login, line, "login_required", func() map[string]string {
		return map[string]string{"cli": c.patterns.CLI, "prompt": line}
	}); e != nil {
		return e
	}

	if e := c.matchPattern(c.patterns.TrustDialog, line, "trust_dialog", func() map[string]string {
		return map[string]string{"prompt": line, "auto_approved": "false"}
	}); e != nil {
		return e
	}

	if e := c.matchPattern(c.patterns.Bypass, line, "bypass_permissions", func() map[string]string {
		return map[string]string{"prompt": line, "auto_approved": "false"}
	}); e != nil {
		return e
	}

	if e := c.matchPattern(c.patterns.ToolStart, line, "tool_call_started", func() map[string]string {
		tool := extractTool(line)
		preview := truncateRunes(line, 120)
		return map[string]string{"tool": tool, "input_preview": preview}
	}); e != nil {
		return e
	}

	if e := c.matchPattern(c.patterns.ToolEnd, line, "tool_call_completed", func() map[string]string {
		tool := extractTool(line)
		dur := extractDuration(line)
		return map[string]string{"tool": tool, "duration_ms": dur}
	}); e != nil {
		return e
	}

	if e := c.matchPattern(c.patterns.Error, line, "error", func() map[string]string {
		return map[string]string{"message": line, "severity": "error"}
	}); e != nil {
		return e
	}

	if e := c.matchPattern(c.patterns.Model, line, "model_changed", func() map[string]string {
		return map[string]string{"from": "", "to": line}
	}); e != nil {
		return e
	}

	if e := c.matchPattern(c.patterns.SessionEnd, line, "session_ended", func() map[string]string {
		return map[string]string{"cli": c.patterns.CLI}
	}); e != nil {
		return e
	}

	// State change detection with debounce
	newState := ""
	if c.patterns.Idle != nil && c.patterns.Idle.MatchString(line) {
		newState = "idle"
	} else if c.patterns.Working != nil && c.patterns.Working.MatchString(line) {
		newState = "working"
	}

	if newState != "" && newState != c.currentState {
		elapsed := now - c.stateChangeTS
		if elapsed >= stateDebounceSeconds {
			oldState := c.currentState
			c.currentState = newState
			c.stateChangeTS = now
			c.seq++
			e := events.New(c.session, c.pane, c.source, c.seq, "state_change",
				map[string]string{"from": oldState, "to": newState})
			return &e
		}
	}

	return nil
}

func (c *Classifier) RawOutput(line string) events.Event {
	c.seq++
	return events.New(c.session, c.pane, c.source, c.seq, "raw_output",
		map[string]string{"line": line})
}

func (c *Classifier) CommandReceived(text, sender string) events.Event {
	c.seq = 1000001
	return events.New(c.session, c.pane, c.source, c.seq, "command_received",
		map[string]string{"text": text, "sender": sender})
}

func (c *Classifier) matchPattern(re *regexp.Regexp, line, eventType string, dataFn func() map[string]string) *events.Event {
	if re == nil {
		return nil
	}
	if !re.MatchString(line) {
		return nil
	}
	c.seq++
	e := events.New(c.session, c.pane, c.source, c.seq, eventType, dataFn())
	return &e
}

var toolParenRe = regexp.MustCompile(`\(([a-z]+)\)$`)
var toolBulletRe = regexp.MustCompile(`[●✓]\s+([A-Za-z]+)`)

func extractTool(line string) string {
	if m := toolParenRe.FindStringSubmatch(line); len(m) > 1 {
		return m[1]
	}
	if m := toolBulletRe.FindStringSubmatch(line); len(m) > 1 {
		return m[1]
	}
	return "unknown"
}

var durationRe = regexp.MustCompile(`\(([0-9.]+)s\)`)
var resetTimeRe = regexp.MustCompile(`[0-9]{1,2}(:[0-9]{2})?\s*[aApP][mM]`)
var resetRelRe = regexp.MustCompile(`in [0-9]+ (hour|minute|second)s?`)

func extractDuration(line string) string {
	if m := durationRe.FindStringSubmatch(line); len(m) > 1 {
		return m[1]
	}
	return ""
}

func extractResetTime(line string) string {
	if m := resetTimeRe.FindString(line); m != "" {
		return m
	}
	if m := resetRelRe.FindString(line); m != "" {
		return m
	}
	return ""
}

var ansiRe = regexp.MustCompile(`\x1b\[[\?]?[0-9;]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b[()][0-9A-B]|\x0f|\x1b=|\x1b>`)

func truncateRunes(s string, maxRunes int) string {
	runes := []rune(s)
	if len(runes) <= maxRunes {
		return s
	}
	return string(runes[:maxRunes])
}

func StripANSI(line string) string {
	return strings.TrimSpace(ansiRe.ReplaceAllString(line, ""))
}
