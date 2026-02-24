import {Trello} from './trello';

export interface Reply {
    u: string;       // user short key
    t: string;       // reply text
    ts: number;      // unix timestamp (seconds)
}

export interface Annotation {
    i: number;       // sequential annotation ID
    u: string;       // author short key
    p: string;       // encoded path "x,y;x,y;..." (single point = dot)
    c: number;       // color index (0-5)
    t: string;       // text note
    ts: number;      // unix timestamp (seconds)
    r: Reply[];      // replies
}

export interface MarkupData {
    u: { [shortKey: string]: string };                  // user lookup: short key -> full trello ID
    d: { [attachmentId: string]: Annotation[] };        // annotations by attachment
}

export interface CapabilityProps {
    baseUrl: string;
    icon: {
        light: string;
        dark: string;
    }
}
