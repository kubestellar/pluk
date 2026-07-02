import { Classifier, stripANSI } from './classifier.js';
import { getPatterns } from './patterns.js';
import { createInterface } from 'node:readline';
export function watch(opts) {
    const cli = opts.cli ?? 'claude';
    const patterns = getPatterns(cli, opts.patternsDir);
    const classifier = new Classifier({
        session: opts.session,
        patterns,
        source: 'watch',
    });
    const input = opts.input ?? process.stdin;
    const filterSet = opts.filter ? new Set(opts.filter) : null;
    const includeRaw = opts.includeRaw ?? false;
    const rl = createInterface({ input, crlfDelay: Infinity });
    rl.on('line', (raw) => {
        try {
            const clean = stripANSI(raw);
            if (!clean)
                return;
            const classified = classifier.classify(clean);
            if (classified) {
                if (!filterSet || filterSet.has(classified.type)) {
                    opts.onEvent(classified);
                }
            }
            if (includeRaw) {
                const rawEvent = classifier.rawOutput(raw);
                if (!filterSet || filterSet.has('raw_output')) {
                    opts.onEvent(rawEvent);
                }
            }
        }
        catch {
            // Never crash on malformed input — pipe-pane dies if we exit
        }
    });
    rl.on('error', () => {
        // Silently handle readline errors to keep pipe-pane alive
    });
    input.on('error', () => {
        // Silently handle input stream errors
    });
    return {
        stop() {
            rl.close();
        },
    };
}
