import { type PlukEvent } from './event.js';
import { type PatternSet } from './patterns.js';
export declare function stripANSI(line: string): string;
export interface ClassifierOptions {
    session: string;
    pane?: string;
    source?: string;
    patterns: PatternSet;
}
export declare class Classifier {
    private patterns;
    private session;
    private pane;
    private source;
    private seq;
    private currentState;
    private stateChangeTS;
    constructor(opts: ClassifierOptions);
    classify(line: string): PlukEvent | null;
    rawOutput(line: string): PlukEvent;
    commandReceived(text: string, sender: string): PlukEvent;
}
