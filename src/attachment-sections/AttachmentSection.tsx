import React, {useState, useEffect, useRef, useCallback} from 'react';
import {useProvidedTrello} from '@optro/ui-react';
import {getMarkupData, getAnnotationsForAttachment} from '../api/power-up';
import {MarkupData} from '../types/power-up';
import {isImageAttachment} from '../lib/data-model';
import {renderAnnotationsOnCanvas} from '../lib/render-annotations';
import {getAuthenticatedUrl} from '../lib/trello-auth';

interface AnnotatedImage {
    id: string;
    name: string;
    url: string;
    previews: any[];
    annotationCount: number;
    annotations: { index: number; text: string }[];
}

function AttachmentSection() {
    const t = useProvidedTrello();
    const [images, setImages] = useState<AnnotatedImage[]>([]);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        t.getRestApi().isAuthorized().then((authorized: boolean) => {
            if (authorized) {
                t.getRestApi().getToken().then((tok: string | null) => setToken(tok));
            }
        });
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
                        annotationCount: annotations.length,
                        annotations: annotations.map(a => ({ index: a.i + 1, text: a.t || '' }))
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
            url: './markup-editor',
            args: {
                attachmentId: img.id,
                attachmentUrl: imageUrl,
                attachmentName: img.name
            },
            title: `Markup: ${img.name}`,
            fullscreen: true
        });
    };

    useEffect(() => {
        if (images.length > 0) {
            setTimeout(() => t.sizeTo('#react-root'), 100);
        }
    }, [images]);

    if (images.length === 0) {
        return null;
    }

    return (
        <div>
            {images.map(img => (
                <AttachmentPreview
                    key={img.id}
                    image={img}
                    token={token}
                    onClick={() => openEditor(img)}
                    onImageLoad={() => t.sizeTo('#react-root')}
                />
            ))}
        </div>
    );
}

function AttachmentPreview({ image, token, onClick, onImageLoad }: { image: AnnotatedImage; token: string | null; onClick: () => void; onImageLoad: () => void }) {
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

    const handleLoad = () => {
        setLoaded(true);
        onImageLoad();
    };

    return (
        <div
            style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
            }}
            onClick={onClick}
        >
            <div style={{ position: 'relative' }}>
                <img
                    ref={imgRef}
                    src={token ? getAuthenticatedUrl(image.url, token) : image.url}
                    alt={image.name}
                    style={{ display: 'block', maxHeight: '220px', maxWidth: '100%' }}
                    onLoad={handleLoad}
                />
                {loaded && (
                    <canvas
                        ref={canvasRef}
                        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                    />
                )}
            </div>
            <div style={{
                display: 'flex',
                flexDirection: 'column' as const,
                gap: '2px',
                fontSize: '12px',
                color: '#5e6c84'
            }}>
                <span style={{ fontWeight: 500, color: '#CECFD2', fontSize: '14px' }}>{image.name}</span>
                {image.annotations.map(a => (
                    <span key={a.index} style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '280px',
                        display: 'block'
                    }}>
                        {a.index}. {a.text}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default AttachmentSection;
