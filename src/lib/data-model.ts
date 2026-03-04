export const COLORS: string[] = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#AF52DE'];

export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

export function isImageAttachment(attachment: { name: string; url: string; previews?: any[] }): boolean {
    const name = attachment.name.toLowerCase();
    if (IMAGE_EXTENSIONS.some(ext => name.endsWith(ext))) return true;
    if (attachment.previews && attachment.previews.length > 0) return true;
    return false;
}

export function getPathStart(path: string): { x: number; y: number } {
    const first = path.split(';')[0];
    if (!first) return { x: 500, y: 500 };
    const [x, y] = first.split(',').map(Number);
    return { x, y };
}

export function getPathCentroid(path: string): { x: number; y: number } {
    const points = path.split(';').map(p => {
        const [x, y] = p.split(',').map(Number);
        return { x, y };
    });
    if (points.length === 0) return { x: 500, y: 500 };
    const sumX = points.reduce((s, p) => s + p.x, 0);
    const sumY = points.reduce((s, p) => s + p.y, 0);
    return {
        x: Math.round(sumX / points.length),
        y: Math.round(sumY / points.length)
    };
}
