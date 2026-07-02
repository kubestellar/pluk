export interface PatternSet {
    cli: string;
    idle: RegExp | null;
    working: RegExp | null;
    rateLimit: RegExp | null;
    login: RegExp | null;
    trustDialog: RegExp | null;
    bypass: RegExp | null;
    toolStart: RegExp | null;
    toolEnd: RegExp | null;
    error: RegExp | null;
    model: RegExp | null;
    sessionEnd: RegExp | null;
}
export declare function loadPatterns(patternsDir: string, cli: string): PatternSet;
export declare function parsePatternsContent(content: string, cli: string): PatternSet;
export declare function listAvailableCLIs(patternsDir: string): string[];
export declare function bundledPatternsDir(): string;
export declare const BUILTIN_PATTERNS: Record<string, string>;
export declare function getPatterns(cli: string, patternsDir?: string): PatternSet;
