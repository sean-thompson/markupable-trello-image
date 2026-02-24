export interface Point {
    x: number;
    y: number;
}

export function pixelToNorm(px: number, py: number, imgWidth: number, imgHeight: number): Point {
    return {
        x: Math.round((px / imgWidth) * 1000),
        y: Math.round((py / imgHeight) * 1000)
    };
}

export function normToPixel(nx: number, ny: number, imgWidth: number, imgHeight: number): Point {
    return {
        x: (nx / 1000) * imgWidth,
        y: (ny / 1000) * imgHeight
    };
}

export function encodePoints(points: Point[]): string {
    return points.map(p => `${p.x},${p.y}`).join(';');
}

export function decodePoints(encoded: string): Point[] {
    if (!encoded) return [];
    return encoded.split(';').map(s => {
        const [x, y] = s.split(',').map(Number);
        return { x, y };
    });
}

// Perpendicular distance from point to line segment
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lineLenSq = dx * dx + dy * dy;

    if (lineLenSq === 0) {
        const ex = point.x - lineStart.x;
        const ey = point.y - lineStart.y;
        return Math.sqrt(ex * ex + ey * ey);
    }

    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLenSq;
    const clampedT = Math.max(0, Math.min(1, t));
    const projX = lineStart.x + clampedT * dx;
    const projY = lineStart.y + clampedT * dy;
    const ex = point.x - projX;
    const ey = point.y - projY;
    return Math.sqrt(ex * ex + ey * ey);
}

// Ramer-Douglas-Peucker path simplification
export function simplifyPath(points: Point[], epsilon: number = 8): Point[] {
    if (points.length <= 2) return points;

    let maxDist = 0;
    let maxIdx = 0;

    for (let i = 1; i < points.length - 1; i++) {
        const dist = perpendicularDistance(points[i], points[0], points[points.length - 1]);
        if (dist > maxDist) {
            maxDist = dist;
            maxIdx = i;
        }
    }

    if (maxDist > epsilon) {
        const left = simplifyPath(points.slice(0, maxIdx + 1), epsilon);
        const right = simplifyPath(points.slice(maxIdx), epsilon);
        return left.slice(0, -1).concat(right);
    } else {
        return [points[0], points[points.length - 1]];
    }
}
