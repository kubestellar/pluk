export interface SendOptions {
    session: string;
    text: string;
    enter?: boolean;
    literal?: boolean;
}
export declare function send(opts: SendOptions): void;
