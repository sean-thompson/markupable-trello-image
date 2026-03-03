import React, {useState, useEffect, useRef, useCallback} from 'react';
import {useProvidedTrello} from '@optro/ui-react';
import {getMarkupData, getAnnotationsForAttachment} from '../api/power-up';
import {MarkupData} from '../types/power-up';
import {isImageAttachment} from '../lib/data-model';
import {renderAnnotationsOnCanvas} from '../lib/render-annotations';

interface AnnotatedImage {
    id: string;
    name: string;
    url: string;
    previews: any[];
    annotationCount: number;
}

function AttachmentSection() {
    const t = useProvidedTrello();
    const [images, setImages] = useState<AnnotatedImage[]>([]);

    useEffect(() => {
        loadAnnotatedImages();
    }, []);

    const loadAnnotatedImages = async () => {
        try {
            const data = await getMarkupData(t);
            const card = await t.card('attachments');
            const attachments = (card.attachments || []).filter(
                (a: any) => isImageAttachment(a)
            );

            const annotated: AnnotatedImage[] = [];
            for (const att of attachments) {
                const annotations = getAnnotationsForAttachment(data, att.id);
                if (annotations.length > 0) {
                    let thumbUrl = att.url;
                    if (att.previews && att.previews.length > 0) {
                        const mid = att.previews.find((p: any) => p.width >= 300 && p.width <= 600) || att.previews[0];
                        thumbUrl = mid.url;
                    }
                    annotated.push({
                        id: att.id,
                        name: att.name,
                        url: thumbUrl,
                        previews: att.previews,
                        annotationCount: annotations.length
                    });
                }
            }
            setImages(annotated);
        } catch (e) {
            console.error('Failed to load annotated images:', e);
        }
    };

    const openEditor = (img: AnnotatedImage) => {
        let imageUrl = img.url;
        if (img.previews && img.previews.length > 0) {
            const sorted = [...img.previews]
                .filter((p: any) => p.url)
                .sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
            if (sorted.length > 0) imageUrl = sorted[0].url;
        }

        t.modal({
            url: './markup-editor.html',
            args: {
                attachmentId: img.id,
                attachmentUrl: imageUrl,
                attachmentName: img.name
            },
            title: `Markup: ${img.name}`,
            fullscreen: true
        });
    };

    if (images.length === 0) {
        return null;
    }

    return (
        <div style={{ padding: '8px' }}>
            {images.map(img => (
                <AttachmentPreview
                    key={img.id}
                    image={img}
                    onClick={() => openEditor(img)}
                />
            ))}
        </div>
    );
}

function AttachmentPreview({ image, onClick }: { image: AnnotatedImage; onClick: () => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const t = useProvidedTrello();
    const [loaded, setLoaded] = useState(false);

    const drawOverlay = useCallback(async () => {
        if (!imgRef.current || !canvasRef.current) return;
        const img = imgRef.current;
        const canvas = canvasRef.current;
        canvas.width = img.clientWidth;
        canvas.height = img.clientHeight;

        try {
            const data = await getMarkupData(t);
            const annotations = getAnnotationsForAttachment(data, image.id);
            const ctx = canvas.getContext('2d');
            if (ctx) {
                renderAnnotationsOnCanvas(ctx, annotations, canvas.width, canvas.height);
            }
        } catch {
            // ignore
        }
    }, [image.id, t]);

    useEffect(() => {
        if (loaded) drawOverlay();
    }, [loaded, drawOverlay]);

    return (
        <div
            style={{
                cursor: 'pointer',
                marginBottom: '8px',
                borderRadius: '4px',
                overflow: 'hidden',
                border: '1px solid #dfe1e6',
                position: 'relative',
                display: 'inline-block'
            }}
            onClick={onClick}
        >
            <div style={{ position: 'relative' }}>
                <img
                    ref={imgRef}
                    src={image.url}
                    alt={image.name}
                    style={{ display: 'block', maxHeight: '200px', maxWidth: '100%' }}
                    onLoad={() => setLoaded(true)}
                />
                {loaded && (
                    <canvas
                        ref={canvasRef}
                        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                    />
                )}
            </div>
            <div style={{
                padding: '4px 8px',
                fontSize: '12px',
                color: '#5e6c84',
                background: '#f4f5f7'
            }}>
                {image.name} - {image.annotationCount} {image.annotationCount === 1 ? 'annotation' : 'annotations'}
            </div>
        </div>
    );
}

export default AttachmentSection;
