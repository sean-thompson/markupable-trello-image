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

    useEffect(() => {
        t.card('attachments').then((card: any) => {
            const attachments: ImageAttachment[] = (card.attachments || []).filter(
                (a: any) => isImageAttachment(a)
            );
            setImages(attachments);
            setLoading(false);
        }).catch(() => {
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
                attachmentUrl: imageUrl,
                attachmentName: attachment.name
            },
            title: `Markup: ${attachment.name}`,
            fullscreen: true
        });
    };

    if (loading) {
        return <div style={{ padding: '12px' }}>Loading attachments...</div>;
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
                const thumbUrl = img.previews && img.previews.length > 0
                    ? (img.previews.find((p: any) => p.width >= 150 && p.width <= 300) || img.previews[0]).url
                    : img.url;
                return (
                    <div
                        key={img.id}
                        className="image-list-item"
                        onClick={() => openEditor(img)}
                    >
                        <img
                            src={thumbUrl}
                            alt={img.name}
                            className="image-list-thumb"
                            onError={(e) => {
                                const el = e.currentTarget;
                                el.style.display = 'none';
                                const placeholder = document.createElement('div');
                                placeholder.className = 'image-list-thumb image-list-thumb-fallback';
                                placeholder.textContent = img.name.split('.').pop()?.toUpperCase() || 'IMG';
                                el.parentElement?.insertBefore(placeholder, el);
                            }}
                        />
                        <span className="image-list-name">{img.name}</span>
                    </div>
                );
            })}
        </div>
    );
}

export default CardButton;
