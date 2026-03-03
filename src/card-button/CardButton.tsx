import React, {useState, useEffect} from 'react';
import {useProvidedTrello} from '@optro/ui-react';
import {isImageAttachment} from '../lib/data-model';
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
    // Track thumbnail load failures per image id: 0 = preview, 1 = full url, 2 = gave up
    const [thumbFallback, setThumbFallback] = useState<{ [id: string]: number }>({});

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
                    console.log('[CardButton] auth token:', tok ? `${tok.substring(0, 8)}...` : 'NULL');
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
            console.log('[CardButton] authorized, token:', tok ? `${tok.substring(0, 8)}...` : 'NULL');
            if (tok) {
                setToken(tok);
                setNeedsAuth(false);
            }
        } catch (e) {
            console.error('[CardButton] authorize failed:', e);
            setAuthError('Authorization failed. Make sure your tunnel URL is added to "Allowed Origins" in the Power-Up admin.');
        }
    };

    const authenticateUrl = (url: string): string => {
        if (!token || !process.env.POWERUP_APP_KEY) return url;
        const sep = url.includes('?') ? '&' : '?';
        return `${url}${sep}key=${process.env.POWERUP_APP_KEY}&token=${token}`;
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
            url: './markup-editor.html',
            args: {
                attachmentId: attachment.id,
                attachmentUrl: authenticateUrl(imageUrl),
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

    const getThumbUrl = (img: ImageAttachment): string | null => {
        const stage = thumbFallback[img.id] || 0;
        if (stage === 0) {
            // Stage 0: try preview URL
            if (img.previews && img.previews.length > 0) {
                return (img.previews.find((p: any) => p.width >= 150 && p.width <= 300) || img.previews[0]).url;
            }
            // No previews available, skip to full URL
            return img.url;
        }
        if (stage === 1) {
            // Stage 1: try full attachment URL
            return img.url;
        }
        // Stage 2+: gave up
        return null;
    };

    const handleThumbError = (img: ImageAttachment) => {
        const stage = thumbFallback[img.id] || 0;
        const nextStage = stage === 0 && img.previews && img.previews.length > 0 ? 1 : 2;
        console.warn(`[CardButton] thumb failed for "${img.name}" at stage ${stage}, advancing to ${nextStage}`, {
            url: getThumbUrl(img)?.substring(0, 80)
        });
        setThumbFallback(prev => ({ ...prev, [img.id]: nextStage }));
    };

    return (
        <div className="image-list">
            {images.map((img) => {
                const thumbUrl = getThumbUrl(img);
                return (
                    <div
                        key={img.id}
                        className="image-list-item"
                        onClick={() => openEditor(img)}
                    >
                        {thumbUrl ? (
                            <img
                                src={authenticateUrl(thumbUrl)}
                                alt={img.name}
                                className="image-list-thumb"
                                onError={() => handleThumbError(img)}
                            />
                        ) : (
                            <div className="image-list-thumb image-list-thumb-fallback">
                                {img.name.split('.').pop()?.toUpperCase() || 'IMG'}
                            </div>
                        )}
                        <span className="image-list-name">{img.name}</span>
                    </div>
                );
            })}
        </div>
    );
}

export default CardButton;
