import {Trello} from '../types/trello';
import {MarkupData, Annotation, Reply} from '../types/power-up';

const STORAGE_KEY = 'mkp';
const MAX_SIZE = 4096;
const WARN_SIZE = 3500;

function emptyData(): MarkupData {
    return { u: {}, d: {} };
}

export async function getMarkupData(t: Trello.PowerUp.IFrame): Promise<MarkupData> {
    try {
        const raw: string = await t.get('card', 'shared', STORAGE_KEY, '');
        if (!raw) return emptyData();
        return JSON.parse(raw) as MarkupData;
    } catch {
        return emptyData();
    }
}

export async function setMarkupData(t: Trello.PowerUp.IFrame, data: MarkupData): Promise<void> {
    const json = JSON.stringify(data);
    if (json.length > MAX_SIZE) {
        throw new Error(`Data exceeds ${MAX_SIZE} character limit (${json.length} chars)`);
    }
    await t.set('card', 'shared', STORAGE_KEY, json);
}

export function estimateDataSize(data: MarkupData): number {
    return JSON.stringify(data).length;
}

export function isNearLimit(data: MarkupData): 'ok' | 'warn' | 'block' {
    const size = estimateDataSize(data);
    if (size >= MAX_SIZE - 150) return 'block';
    if (size >= WARN_SIZE) return 'warn';
    return 'ok';
}

export function getUserShortKey(data: MarkupData, memberId: string): string {
    for (const [key, id] of Object.entries(data.u)) {
        if (id === memberId) return key;
    }
    // Create new short key
    const keys = Object.keys(data.u);
    const nextKey = String.fromCharCode(97 + keys.length); // a, b, c, ...
    data.u[nextKey] = memberId;
    return nextKey;
}

export function getAnnotationsForAttachment(data: MarkupData, attachmentId: string): Annotation[] {
    return data.d[attachmentId] || [];
}

export function getAnnotationCount(data: MarkupData): number {
    let count = 0;
    for (const attachmentId of Object.keys(data.d)) {
        count += data.d[attachmentId].length;
    }
    return count;
}

export async function addAnnotation(
    t: Trello.PowerUp.IFrame,
    attachmentId: string,
    memberId: string,
    path: string,
    colorIndex: number,
    text: string
): Promise<MarkupData> {
    const data = await getMarkupData(t);
    const userKey = getUserShortKey(data, memberId);

    if (!data.d[attachmentId]) {
        data.d[attachmentId] = [];
    }

    const annotations = data.d[attachmentId];
    const maxId = annotations.reduce((max, a) => Math.max(max, a.i), -1);

    const annotation: Annotation = {
        i: maxId + 1,
        u: userKey,
        p: path,
        c: colorIndex,
        t: text,
        ts: Math.floor(Date.now() / 1000),
        r: []
    };

    annotations.push(annotation);
    await setMarkupData(t, data);
    return data;
}

export async function addReply(
    t: Trello.PowerUp.IFrame,
    attachmentId: string,
    annotationId: number,
    memberId: string,
    text: string
): Promise<MarkupData> {
    const data = await getMarkupData(t);
    const userKey = getUserShortKey(data, memberId);
    const annotations = data.d[attachmentId];
    if (!annotations) throw new Error('Attachment not found');

    const annotation = annotations.find(a => a.i === annotationId);
    if (!annotation) throw new Error('Annotation not found');

    const reply: Reply = {
        u: userKey,
        t: text,
        ts: Math.floor(Date.now() / 1000)
    };

    annotation.r.push(reply);
    await setMarkupData(t, data);
    return data;
}

export async function changeAnnotationColor(
    t: Trello.PowerUp.IFrame,
    attachmentId: string,
    annotationId: number,
    memberId: string,
    newColorIndex: number
): Promise<MarkupData> {
    const data = await getMarkupData(t);
    const userKey = getUserShortKey(data, memberId);
    const annotations = data.d[attachmentId];
    if (!annotations) throw new Error('Attachment not found');

    const annotation = annotations.find(a => a.i === annotationId);
    if (!annotation) throw new Error('Annotation not found');
    if (annotation.u !== userKey) throw new Error('Only the author can change the color');

    annotation.c = newColorIndex;
    await setMarkupData(t, data);
    return data;
}

export async function deleteAnnotation(
    t: Trello.PowerUp.IFrame,
    attachmentId: string,
    annotationId: number,
    memberId: string
): Promise<MarkupData> {
    const data = await getMarkupData(t);
    const userKey = getUserShortKey(data, memberId);
    const annotations = data.d[attachmentId];
    if (!annotations) throw new Error('Attachment not found');

    const idx = annotations.findIndex(a => a.i === annotationId);
    if (idx === -1) throw new Error('Annotation not found');
    if (annotations[idx].u !== userKey) throw new Error('Only the author can delete');

    annotations.splice(idx, 1);
    if (annotations.length === 0) {
        delete data.d[attachmentId];
    }
    await setMarkupData(t, data);
    return data;
}

export async function removeAllMarkupData(t: Trello.PowerUp.IFrame): Promise<void> {
    const cards: Trello.PowerUp.Card[] = await t.cards('all');
    for (const card of cards) {
        await t.set(card.id, 'shared', STORAGE_KEY, '');
    }
    await t.alert({
        message: 'All markup data deleted!',
        display: 'info',
        duration: 5
    });
}
