import { type PlukEvent, type PlukEventType } from './event.js';
import { type Readable } from 'node:stream';
export interface WatchOptions {
    session: string;
    cli?: string;
    patternsDir?: string;
    input?: Readable;
    filter?: PlukEventType[];
    includeRaw?: boolean;
    onEvent: (event: PlukEvent) => void;
}
export declare function watch(opts: WatchOptions): {
    stop: () => void;
};
