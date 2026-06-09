package classify

import (
	"bufio"
	"fmt"
	"os"
	"regexp"
	"strings"
)

type Patterns struct {
	CLI            string
	Idle           *regexp.Regexp
	Working        *regexp.Regexp
	RateLimit      *regexp.Regexp
	Login          *regexp.Regexp
	TrustDialog    *regexp.Regexp
	Bypass         *regexp.Regexp
	ToolStart      *regexp.Regexp
	ToolEnd        *regexp.Regexp
	Error          *regexp.Regexp
	Model          *regexp.Regexp
	SessionEnd     *regexp.Regexp
}

func LoadPatterns(patternsDir, cli string) (*Patterns, error) {
	path := patternsDir + "/" + cli + ".patterns"
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	vars := make(map[string]string)
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		val = strings.Trim(val, "'")
		vars[key] = val
	}

	p := &Patterns{CLI: cli}
	p.Idle = compileOptional(vars["IDLE_PATTERN"])
	p.Working = compileOptional(vars["WORKING_PATTERNS"])
	p.RateLimit = compileOptional(vars["RATE_LIMIT_PATTERN"])
	p.Login = compileOptional(vars["LOGIN_PATTERN"])
	p.TrustDialog = compileOptional(vars["TRUST_DIALOG_PATTERN"])
	p.Bypass = compileOptional(vars["BYPASS_PATTERN"])
	p.ToolStart = compileOptional(vars["TOOL_START_PATTERN"])
	p.ToolEnd = compileOptional(vars["TOOL_END_PATTERN"])
	p.Error = compileOptional(vars["ERROR_PATTERN"])
	p.Model = compileOptional(vars["MODEL_PATTERN"])
	p.SessionEnd = compileOptional(vars["SESSION_END_PATTERN"])

	return p, nil
}

func compileOptional(pattern string) *regexp.Regexp {
	if pattern == "" {
		return nil
	}
	re, err := regexp.Compile(pattern)
	if err != nil {
		fmt.Fprintf(os.Stderr, "pluk: invalid pattern %q: %v\n", pattern, err)
		return nil
	}
	return re
}
