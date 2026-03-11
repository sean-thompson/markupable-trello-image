import React, {useState, useEffect} from 'react';
import {useProvidedTrello} from '@optro/ui-react';
import {isImageAttachment} from '../lib/data-model';
import {getAuthenticatedUrl} from '../lib/trello-auth';
import './styles.css';

interface ImageAttachment {
    id: string;
    name: string;
    url: string;
    previews: any[];
}

function CardButton() {
    const t = useProvidedTrello();
    const [images, setImages] = useState<ImageAttachment[]>([]);
    const [loading, setLoading] = useState(true);
    // Track fallback stage per thumbnail: preview → full → failed
    const [thumbStage, setThumbStage] = useState<{ [id: string]: 'preview' | 'full' | 'failed' }>({});

    // Auth state
    const [token, setToken] = useState<string | null>(null);
    const [needsAuth, setNeedsAuth] = useState(false);
    const [authChecked, setAuthChecked] = useState(false);

    // Auth error message for user-visible feedback
    const [authError, setAuthError] = useState<string | null>(null);

    // Check REST API authorization on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const restApi = (t as any).getRestApi();
                const authorized = await restApi.isAuthorized();
                if (authorized) {
                    const tok = await restApi.getToken();
                    if (tok) {
                        setToken(tok);
                    } else {
                        setNeedsAuth(true);
                    }
                } else {
                    setNeedsAuth(true);
                }
            } catch (e) {
                console.error('[CardButton] getRestApi() failed:', e);
                setNeedsAuth(true);
            }
            setAuthChecked(true);
        };
        checkAuth();
    }, []);

    const handleAuthorize = async () => {
        setAuthError(null);
        try {
            const restApi = (t as any).getRestApi();
            await restApi.authorize({ scope: 'read' });
            const tok = await restApi.getToken();
            if (tok) {
                setToken(tok);
                setNeedsAuth(false);
            }
        } catch (e) {
            console.error('[CardButton] authorize failed:', e);
            setAuthError('Authorization failed. Make sure your tunnel URL is added to "Allowed Origins" in the Power-Up admin.');
        }
    };

    useEffect(() => {
        t.card('attachments').then((card: any) => {
            const attachments: ImageAttachment[] = (card.attachments || []).filter(
                (a: any) => isImageAttachment(a)
            );
            setImages(attachments);
            setLoading(false);
        }).catch((err: any) => {
            console.error('[CardButton] failed to load attachments:', err);
            setLoading(false);
        });
    }, []);

    const getThumbUrl = (img: ImageAttachment): string => {
        if (img.previews && img.previews.length > 0) {
            const thumb = img.previews.find((p: any) => p.url && p.width >= 150 && p.width <= 300)
                || img.previews.find((p: any) => p.url);
            if (thumb) return thumb.url;
        }
        return img.url;
    };

    const handleThumbError = (img: ImageAttachment) => {
        setThumbStage(prev => {
            const current = prev[img.id] || 'preview';
            if (current === 'preview' && getThumbUrl(img) !== img.url) {
                return { ...prev, [img.id]: 'full' };
            }
            if (current !== 'failed') {
                return { ...prev, [img.id]: 'failed' };
            }
            return prev;
        });
    };

    const openEditor = (attachment: ImageAttachment) => {
        // Get the best preview URL or fall back to the attachment URL
        let imageUrl = attachment.url;
        if (attachment.previews && attachment.previews.length > 0) {
            // Pick the largest preview
            const sorted = [...attachment.previews]
                .filter((p: any) => p.url)
                .sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
            if (sorted.length > 0) {
                imageUrl = sorted[0].url;
            }
        }

        t.modal({
            url: './markup-editor',
            args: {
                attachmentId: attachment.id,
                attachmentUrl: imageUrl,
                attachmentName: attachment.name
            },
            title: `Markup: ${attachment.name}`,
            fullscreen: true
        });
    };

    if (loading || !authChecked) {
        return <div style={{ padding: '12px' }}>Loading attachments...</div>;
    }

    if (needsAuth) {
        return (
            <div style={{ padding: '12px', textAlign: 'center' }}>
                <p>This Power-Up needs permission to display image attachments.</p>
                <button
                    onClick={handleAuthorize}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: '#0079BF',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}
                >
                    Authorize
                </button>
                {authError && (
                    <p style={{ color: '#c0392b', fontSize: '0.85em', marginTop: '8px' }}>
                        {authError}
                    </p>
                )}
            </div>
        );
    }

    if (images.length === 0) {
        return (
            <div style={{ padding: '12px' }}>
                <p>No image attachments found on this card.</p>
                <p style={{ fontSize: '0.85em', color: '#5e6c84' }}>
                    Attach a PNG, JPG, GIF, or WebP image to get started.
                </p>
            </div>
        );
    }

    return (
        <div className="image-list">
            {images.map((img) => {
                const stage = thumbStage[img.id] || 'preview';
                const stageUrl = stage === 'full' ? img.url : getThumbUrl(img);
                return (
                    <div
                        key={img.id}
                        className="image-list-item"
                        onClick={() => openEditor(img)}
                    >
                        {!token ? (
                            <div className="image-list-thumb image-list-thumb-fallback">
                                ...
                            </div>
                        ) : stage === 'failed' ? (
                            <div className="image-list-thumb image-list-thumb-fallback">
                                {img.name.split('.').pop()?.toUpperCase() || 'IMG'}
                            </div>
                        ) : (
                            <img
                                src={getAuthenticatedUrl(stageUrl, token)}
                                alt={img.name}
                                className="image-list-thumb"
                                onError={() => handleThumbError(img)}
                            />
                        )}
                        <span className="image-list-name">{img.name}</span>
                    </div>
                );
            })}
        </div>
    );
}

export default CardButton;
