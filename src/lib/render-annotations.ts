import {Annotation} from '../types/power-up';
import {COLORS} from './data-model';
import {decodePoints, normToPixel} from './path-encoding';
import {getPathCentroid} from './data-model';

export interface RenderOptions {
    selectedAnnotationId?: number;
    dimNonSelected?: boolean;
    skipMarkers?: boolean;
}

export function renderAnnotationsOnCanvas(
    ctx: CanvasRenderingContext2D,
    annotations: Annotation[],
    canvasWidth: number,
    canvasHeight: number,
    options: RenderOptions = {}
): void {
    const { selectedAnnotationId, dimNonSelected, skipMarkers } = options;

    for (const annotation of annotations) {
        const isSelected = selectedAnnotationId === annotation.i;
        const isDimmed = dimNonSelected && selectedAnnotationId !== undefined && !isSelected;
        const color = COLORS[annotation.c] || COLORS[4];
        const alpha = isDimmed ? 0.25 : 1;
        const lineWidth = isSelected ? 4 : 2.5;

        const points = decodePoints(annotation.p);
        if (points.length === 0) continue;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (points.length === 1) {
            // Dot
            const px = normToPixel(points[0].x, points[0].y, canvasWidth, canvasHeight);
            ctx.beginPath();
            ctx.arc(px.x, px.y, isSelected ? 6 : 4, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Path
            const firstPx = normToPixel(points[0].x, points[0].y, canvasWidth, canvasHeight);
            ctx.beginPath();
            ctx.moveTo(firstPx.x, firstPx.y);
            for (let i = 1; i < points.length; i++) {
                const px = normToPixel(points[i].x, points[i].y, canvasWidth, canvasHeight);
                ctx.lineTo(px.x, px.y);
            }
            ctx.stroke();
        }

        ctx.restore();

        // Draw numbered marker at centroid (unless DOM markers are used)
        if (!skipMarkers) {
            const centroid = getPathCentroid(annotation.p);
            const centroidPx = normToPixel(centroid.x, centroid.y, canvasWidth, canvasHeight);
            drawNumberMarker(ctx, centroidPx.x, centroidPx.y, annotation.i + 1, color, alpha, isSelected);
        }
    }
}

function drawNumberMarker(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    number: number,
    color: string,
    alpha: number,
    isSelected: boolean
): void {
    const radius = isSelected ? 14 : 11;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Circle background
    ctx.beginPath();
    ctx.arc(x, y - radius - 4, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Number text
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${isSelected ? 13 : 11}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(number), x, y - radius - 4);

    ctx.restore();
}

export function hitTestAnnotation(
    annotations: Annotation[],
    clickX: number,
    clickY: number,
    canvasWidth: number,
    canvasHeight: number,
    hitRadius: number = 15
): Annotation | null {
    // Check markers first (they're on top)
    for (let i = annotations.length - 1; i >= 0; i--) {
        const annotation = annotations[i];
        const centroid = getPathCentroid(annotation.p);
        const centroidPx = normToPixel(centroid.x, centroid.y, canvasWidth, canvasHeight);
        const markerY = centroidPx.y - 15; // marker offset
        const dx = clickX - centroidPx.x;
        const dy = clickY - markerY;
        if (Math.sqrt(dx * dx + dy * dy) <= hitRadius) {
            return annotation;
        }
    }

    // Check paths
    for (let i = annotations.length - 1; i >= 0; i--) {
        const annotation = annotations[i];
        const points = decodePoints(annotation.p);
        for (const pt of points) {
            const px = normToPixel(pt.x, pt.y, canvasWidth, canvasHeight);
            const dx = clickX - px.x;
            const dy = clickY - px.y;
            if (Math.sqrt(dx * dx + dy * dy) <= hitRadius) {
                return annotation;
            }
        }
    }

    return null;
}
