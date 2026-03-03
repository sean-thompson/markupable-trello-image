import React, {useState, useEffect, useRef} from 'react';
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
    // Blob URLs for thumbnails, keyed by image id
    const [thumbBlobUrls, setThumbBlobUrls] = useState<{ [id: string]: string }>({});
    // Track which images failed to load (show placeholder)
    const [thumbFailed, setThumbFailed] = useState<{ [id: string]: boolean }>({});
    // Ref to track blob URLs for cleanup
    const blobUrlsRef = useRef<string[]>([]);

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

    const fetchAuthenticatedImage = async (url: string): Promise<string> => {
        const apiUrl = url.replace('https://trello.com/', 'https://api.trello.com/');
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `OAuth oauth_consumer_key="${process.env.POWERUP_APP_KEY}", oauth_token="${token}"`
            }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        blobUrlsRef.current.push(blobUrl);
        return blobUrl;
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

    // Fetch thumbnails as blobs once images and token are available
    useEffect(() => {
        if (!token || images.length === 0) return;

        const fetchThumbnails = async () => {
            const results = await Promise.allSettled(
                images.map(async (img) => {
                    // Try preview URL first, then fall back to full URL
                    const thumbUrl = getThumbUrl(img);
                    try {
                        const blobUrl = await fetchAuthenticatedImage(thumbUrl);
                        return { id: img.id, blobUrl };
                    } catch {
                        // If preview failed and we used a preview URL, try full URL
                        if (thumbUrl !== img.url) {
                            console.warn(`[CardButton] preview fetch failed for "${img.name}", trying full URL`);
                            const blobUrl = await fetchAuthenticatedImage(img.url);
                            return { id: img.id, blobUrl };
                        }
                        throw new Error('All URLs failed');
                    }
                })
            );

            const newBlobUrls: { [id: string]: string } = {};
            const newFailed: { [id: string]: boolean } = {};
            results.forEach((result, idx) => {
                if (result.status === 'fulfilled') {
                    newBlobUrls[result.value.id] = result.value.blobUrl;
                } else {
                    console.warn(`[CardButton] thumb fetch failed for "${images[idx].name}":`, result.reason);
                    newFailed[images[idx].id] = true;
                }
            });
            setThumbBlobUrls(prev => ({ ...prev, ...newBlobUrls }));
            setThumbFailed(prev => ({ ...prev, ...newFailed }));
        };

        fetchThumbnails();
    }, [token, images]);

    // Clean up blob URLs on unmount
    useEffect(() => {
        return () => {
            blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
        };
    }, []);

    const getThumbUrl = (img: ImageAttachment): string => {
        if (img.previews && img.previews.length > 0) {
            const thumb = img.previews.find((p: any) => p.url && p.width >= 150 && p.width <= 300)
                || img.previews.find((p: any) => p.url);
            if (thumb) return thumb.url;
        }
        return img.url;
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
            url: './markup-editor.html',
            args: {
                attachmentId: attachment.id,
                attachmentUrl: imageUrl,  // raw URL, MarkupEditor will auth+fetch itself
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
                const blobUrl = thumbBlobUrls[img.id];
                const failed = thumbFailed[img.id];
                return (
                    <div
                        key={img.id}
                        className="image-list-item"
                        onClick={() => openEditor(img)}
                    >
                        {blobUrl ? (
                            <img
                                src={blobUrl}
                                alt={img.name}
                                className="image-list-thumb"
                            />
                        ) : failed ? (
                            <div className="image-list-thumb image-list-thumb-fallback">
                                {img.name.split('.').pop()?.toUpperCase() || 'IMG'}
                            </div>
                        ) : (
                            <div className="image-list-thumb image-list-thumb-fallback">
                                ...
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
