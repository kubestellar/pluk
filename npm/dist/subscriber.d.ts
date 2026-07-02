import { EventEmitter } from 'node:events';
import { type PlukEvent, type PlukEventType } from './event.js';
export interface SubscriberOptions {
    session: string;
    runDir?: string;
    filter?: PlukEventType[];
    fromBeginning?: boolean;
    verbose?: boolean;
}
export declare class Subscriber extends EventEmitter {
    private session;
    private runDir;
    private filterSet;
    private fromBeginning;
    private aborted;
    private verbose;
    constructor(opts: SubscriberOptions);
    private log;
    get logFile(): string;
    start(): Promise<void>;
    stop(): void;
}
export declare function subscribe(session: string, callback: (event: PlukEvent) => void, opts?: Omit<SubscriberOptions, 'session'>): Subscriber;
