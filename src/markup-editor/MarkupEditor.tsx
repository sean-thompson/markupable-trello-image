import React, {useState, useEffect, useRef, useCallback} from 'react';
import {useProvidedTrello} from '@optro/ui-react';
import {
    getMarkupData, addAnnotation, addReply, changeAnnotationColor,
    deleteAnnotation, getAnnotationsForAttachment, isNearLimit
} from '../api/power-up';
import {MarkupData, Annotation} from '../types/power-up';
import {COLORS} from '../lib/data-model';
import {Point, pixelToNorm, encodePoints, simplifyPath} from '../lib/path-encoding';
import {renderAnnotationsOnCanvas, hitTestAnnotation} from '../lib/render-annotations';
import {timeAgo} from '../lib/time-utils';
import './styles.css';

type EditorMode = 'idle' | 'drawing' | 'text-input';

interface MemberInfo {
    id: string;
    fullName: string;
    avatar: string | null;
}

function MarkupEditor() {
    const t = useProvidedTrello();

    // Params from modal URL
    const [attachmentId, setAttachmentId] = useState('');
    const [attachmentUrl, setAttachmentUrl] = useState('');
    const [attachmentName, setAttachmentName] = useState('');

    // Data
    const [data, setData] = useState<MarkupData | null>(null);
    const [member, setMember] = useState<MemberInfo | null>(null);
    const [memberLookup, setMemberLookup] = useState<{ [id: string]: MemberInfo }>({});

    // UI state
    const [mode, setMode] = useState<EditorMode>('idle');
    const [selectedColor, setSelectedColor] = useState(4); // blue default
    const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
    const [noteText, setNoteText] = useState('');
    const [replyText, setReplyText] = useState('');
    const [imageLoaded, setImageLoaded] = useState(false);
    const [storageStatus, setStorageStatus] = useState<'ok' | 'warn' | 'block'>('ok');

    // Drawing state
    const [currentPath, setCurrentPath] = useState<Point[]>([]);
    const [pendingPath, setPendingPath] = useState<string | null>(null);
    const isDrawingRef = useRef(false);
    const rawPointsRef = useRef<Point[]>([]);

    // Refs
    const imgRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const noteInputRef = useRef<HTMLInputElement>(null);
    const replyInputRef = useRef<HTMLInputElement>(null);

    // Initialize: read params and load data
    useEffect(() => {
        const aId = t.arg('attachmentId', '');
        const aUrl = t.arg('attachmentUrl', '');
        const aName = t.arg('attachmentName', '');
        setAttachmentId(aId);
        setAttachmentUrl(aUrl);
        setAttachmentName(aName);

        t.member('id', 'fullName', 'avatar').then((m: any) => {
            setMember({ id: m.id, fullName: m.fullName, avatar: m.avatar });
        });

        loadData();
    }, []);

    const loadData = useCallback(async () => {
        try {
            const d = await getMarkupData(t);
            setData(d);
            setStorageStatus(isNearLimit(d));
            // Load member info for all users in data
            loadMemberLookup(d);
        } catch (e) {
            console.error('Failed to load markup data:', e);
        }
    }, [t]);

    const loadMemberLookup = useCallback(async (d: MarkupData) => {
        try {
            const board = await t.board('members');
            const members: any[] = board.members || [];
            const lookup: { [id: string]: MemberInfo } = {};
            for (const m of members) {
                lookup[m.id] = {
                    id: m.id,
                    fullName: m.fullName || m.username || 'Unknown',
                    avatar: m.avatar || null
                };
            }
            setMemberLookup(lookup);
        } catch {
            // Board members may not be accessible; fallback
        }
    }, [t]);

    // Redraw canvas
    const redrawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Render saved annotations
        if (data && attachmentId) {
            const annotations = getAnnotationsForAttachment(data, attachmentId);
            renderAnnotationsOnCanvas(ctx, annotations, canvas.width, canvas.height, {
                selectedAnnotationId: selectedAnnotation?.i,
                dimNonSelected: selectedAnnotation !== null
            });
        }

        // Render current drawing in progress
        if (currentPath.length > 0) {
            const color = COLORS[selectedColor];
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (currentPath.length === 1) {
                const px = {
                    x: (currentPath[0].x / 1000) * canvas.width,
                    y: (currentPath[0].y / 1000) * canvas.height
                };
                ctx.beginPath();
                ctx.arc(px.x, px.y, 4, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.beginPath();
                const first = {
                    x: (currentPath[0].x / 1000) * canvas.width,
                    y: (currentPath[0].y / 1000) * canvas.height
                };
                ctx.moveTo(first.x, first.y);
                for (let i = 1; i < currentPath.length; i++) {
                    const p = {
                        x: (currentPath[i].x / 1000) * canvas.width,
                        y: (currentPath[i].y / 1000) * canvas.height
                    };
                    ctx.lineTo(p.x, p.y);
                }
                ctx.stroke();
            }
        }
    }, [data, attachmentId, selectedAnnotation, currentPath, selectedColor]);

    // Resize canvas to match image
    useEffect(() => {
        if (!imageLoaded || !imgRef.current || !canvasRef.current) return;

        const syncSize = () => {
            const img = imgRef.current;
            const canvas = canvasRef.current;
            if (!img || !canvas) return;
            canvas.width = img.clientWidth;
            canvas.height = img.clientHeight;
            redrawCanvas();
        };

        syncSize();

        const observer = new ResizeObserver(syncSize);
        if (imgRef.current) observer.observe(imgRef.current);
        return () => observer.disconnect();
    }, [imageLoaded, data, selectedAnnotation, currentPath, redrawCanvas]);

    // Canvas event handlers
    const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        let clientX: number, clientY: number;
        if ('touches' in e) {
            if (e.touches.length === 0) return null;
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        if (selectedAnnotation || mode === 'text-input' || storageStatus === 'block') return;
        e.preventDefault();

        const coords = getCanvasCoords(e);
        if (!coords) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const norm = pixelToNorm(coords.x, coords.y, canvas.width, canvas.height);
        isDrawingRef.current = true;
        rawPointsRef.current = [norm];
        setCurrentPath([norm]);
        setMode('drawing');
    };

    const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawingRef.current) return;
        e.preventDefault();

        const coords = getCanvasCoords(e);
        if (!coords) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const norm = pixelToNorm(coords.x, coords.y, canvas.width, canvas.height);
        rawPointsRef.current.push(norm);
        setCurrentPath([...rawPointsRef.current]);
    };

    const handlePointerUp = () => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;

        const raw = rawPointsRef.current;
        if (raw.length === 0) {
            setMode('idle');
            return;
        }

        // Simplify path
        const simplified = raw.length <= 2 ? raw : simplifyPath(raw, 8);
        const encoded = encodePoints(simplified);
        setPendingPath(encoded);
        setCurrentPath(simplified);
        setMode('text-input');

        // Focus the note input
        setTimeout(() => noteInputRef.current?.focus(), 50);
    };

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (mode !== 'idle' || !data || !attachmentId) return;

        const coords = getCanvasCoords(e);
        if (!coords) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const annotations = getAnnotationsForAttachment(data, attachmentId);
        const hit = hitTestAnnotation(annotations, coords.x, coords.y, canvas.width, canvas.height);

        if (hit) {
            setSelectedAnnotation(hit);
        }
    };

    // Post annotation
    const handlePost = async () => {
        if (!pendingPath || !member || !attachmentId) return;

        try {
            const newData = await addAnnotation(t, attachmentId, member.id, pendingPath, selectedColor, noteText);
            setData(newData);
            setStorageStatus(isNearLimit(newData));
        } catch (e: any) {
            alert(e.message || 'Failed to save annotation');
        }

        // Reset
        setPendingPath(null);
        setCurrentPath([]);
        setNoteText('');
        setMode('idle');
    };

    const handleCancelDraw = () => {
        setPendingPath(null);
        setCurrentPath([]);
        setNoteText('');
        setMode('idle');
    };

    // Reply
    const handlePostReply = async () => {
        if (!selectedAnnotation || !member || !replyText.trim() || !attachmentId) return;

        try {
            const newData = await addReply(t, attachmentId, selectedAnnotation.i, member.id, replyText.trim());
            setData(newData);
            setStorageStatus(isNearLimit(newData));
            // Update selected annotation from new data
            const updated = getAnnotationsForAttachment(newData, attachmentId)
                .find(a => a.i === selectedAnnotation.i);
            if (updated) setSelectedAnnotation(updated);
        } catch (e: any) {
            alert(e.message || 'Failed to save reply');
        }
        setReplyText('');
    };

    // Change color
    const handleChangeColor = async (colorIdx: number) => {
        if (!selectedAnnotation || !member || !attachmentId) return;

        try {
            const newData = await changeAnnotationColor(t, attachmentId, selectedAnnotation.i, member.id, colorIdx);
            setData(newData);
            const updated = getAnnotationsForAttachment(newData, attachmentId)
                .find(a => a.i === selectedAnnotation.i);
            if (updated) setSelectedAnnotation(updated);
        } catch {
            // Not the author
        }
    };

    // Delete annotation
    const handleDelete = async () => {
        if (!selectedAnnotation || !member || !attachmentId) return;
        if (!confirm('Delete this annotation?')) return;

        try {
            const newData = await deleteAnnotation(t, attachmentId, selectedAnnotation.i, member.id);
            setData(newData);
            setStorageStatus(isNearLimit(newData));
            setSelectedAnnotation(null);
        } catch (e: any) {
            alert(e.message || 'Failed to delete');
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (selectedAnnotation) {
                    setSelectedAnnotation(null);
                } else if (mode === 'text-input') {
                    handleCancelDraw();
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selectedAnnotation, mode]);

    // Resolve user name from data
    const resolveUserName = (shortKey: string): string => {
        if (!data) return 'Unknown';
        const memberId = data.u[shortKey];
        if (!memberId) return 'Unknown';
        const info = memberLookup[memberId];
        return info?.fullName || 'User';
    };

    const isAuthor = (annotation: Annotation): boolean => {
        if (!data || !member) return false;
        return data.u[annotation.u] === member.id;
    };

    // Get annotations for current attachment
    const annotations = data && attachmentId ? getAnnotationsForAttachment(data, attachmentId) : [];

    // Loading state
    if (!attachmentUrl) {
        return (
            <div className="markup-loading">
                <div className="markup-loading-spinner" />
                Loading...
            </div>
        );
    }

    return (
        <div className="markup-editor">
            {/* Toolbar */}
            <div className="markup-toolbar">
                <div className="markup-toolbar-section">
                    <span className="markup-toolbar-label">Color:</span>
                    {COLORS.map((color, idx) => (
                        <div
                            key={idx}
                            className={`color-dot ${selectedColor === idx ? 'selected' : ''} ${selectedAnnotation ? 'disabled' : ''}`}
                            style={{ backgroundColor: color }}
                            onClick={() => !selectedAnnotation && setSelectedColor(idx)}
                            title={['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple'][idx]}
                        />
                    ))}
                </div>
                <div className="markup-toolbar-divider" />
                <span className="markup-toolbar-label" style={{ color: '#172b4d' }}>
                    {attachmentName}
                </span>
                {mode === 'drawing' && (
                    <span className="markup-toolbar-label" style={{ color: '#007AFF', fontWeight: 600 }}>
                        Drawing...
                    </span>
                )}
                {mode === 'text-input' && (
                    <span className="markup-toolbar-label" style={{ color: '#34C759', fontWeight: 600 }}>
                        Add a note below
                    </span>
                )}
            </div>

            {/* Storage warning */}
            {storageStatus === 'warn' && (
                <div className="storage-warning warn">
                    Storage nearly full. Keep annotations brief.
                </div>
            )}
            {storageStatus === 'block' && (
                <div className="storage-warning block">
                    Storage full. Delete some annotations before adding new ones.
                </div>
            )}

            {/* Main area */}
            <div className="markup-main">
                {/* Canvas area */}
                <div className="markup-canvas-area">
                    {!imageLoaded && (
                        <div className="markup-loading">
                            <div className="markup-loading-spinner" />
                            Loading image...
                        </div>
                    )}
                    <div className="markup-image-container" ref={containerRef}>
                        <img
                            ref={imgRef}
                            src={attachmentUrl}
                            alt={attachmentName}
                            onLoad={() => setImageLoaded(true)}
                            style={{ display: imageLoaded ? 'block' : 'none' }}
                            draggable={false}
                        />
                        {imageLoaded && (
                            <canvas
                                ref={canvasRef}
                                className={selectedAnnotation ? 'drawing-disabled' : ''}
                                onMouseDown={handlePointerDown}
                                onMouseMove={handlePointerMove}
                                onMouseUp={handlePointerUp}
                                onMouseLeave={handlePointerUp}
                                onTouchStart={handlePointerDown}
                                onTouchMove={handlePointerMove}
                                onTouchEnd={handlePointerUp}
                                onClick={handleCanvasClick}
                            />
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="markup-sidebar">
                    {selectedAnnotation ? (
                        // Thread view
                        <>
                            <div className="sidebar-header">
                                <h3>Annotation #{selectedAnnotation.i + 1}</h3>
                                <button
                                    className="sidebar-back-btn"
                                    onClick={() => setSelectedAnnotation(null)}
                                >
                                    Back
                                </button>
                            </div>
                            <div className="sidebar-content">
                                <div className="thread-original">
                                    <div className="thread-original-header">
                                        <div
                                            className="annotation-number"
                                            style={{ backgroundColor: COLORS[selectedAnnotation.c] }}
                                        >
                                            {selectedAnnotation.i + 1}
                                        </div>
                                        <div>
                                            <div className="annotation-author">
                                                {resolveUserName(selectedAnnotation.u)}
                                            </div>
                                            <div className="annotation-meta">
                                                {timeAgo(selectedAnnotation.ts)}
                                            </div>
                                        </div>
                                    </div>
                                    {selectedAnnotation.t && (
                                        <div className="thread-original-text">
                                            {selectedAnnotation.t}
                                        </div>
                                    )}

                                    {/* Color picker for author */}
                                    {isAuthor(selectedAnnotation) && (
                                        <div className="thread-color-picker">
                                            {COLORS.map((color, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`color-dot ${selectedAnnotation.c === idx ? 'selected' : ''}`}
                                                    style={{ backgroundColor: color }}
                                                    onClick={() => handleChangeColor(idx)}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* Delete for author */}
                                    {isAuthor(selectedAnnotation) && (
                                        <button className="thread-delete-btn" onClick={handleDelete}>
                                            Delete annotation
                                        </button>
                                    )}
                                </div>

                                {/* Replies */}
                                {selectedAnnotation.r.map((reply, idx) => (
                                    <div key={idx} className="thread-reply">
                                        <div className="thread-reply-author">
                                            {resolveUserName(reply.u)}
                                        </div>
                                        <div className="thread-reply-text">{reply.t}</div>
                                        <div className="thread-reply-time">{timeAgo(reply.ts)}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Reply input */}
                            <div className="markup-input-bar">
                                <input
                                    ref={replyInputRef}
                                    type="text"
                                    placeholder="Write a reply..."
                                    value={replyText}
                                    onChange={e => setReplyText(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handlePostReply();
                                        }
                                    }}
                                />
                                <button
                                    className="btn-post"
                                    disabled={!replyText.trim() || storageStatus === 'block'}
                                    onClick={handlePostReply}
                                >
                                    Reply
                                </button>
                            </div>
                        </>
                    ) : (
                        // Annotation list view
                        <>
                            <div className="sidebar-header">
                                <h3>Annotations ({annotations.length})</h3>
                            </div>
                            <div className="sidebar-content">
                                {annotations.length === 0 ? (
                                    <div className="sidebar-empty">
                                        Draw on the image to add an annotation.
                                    </div>
                                ) : (
                                    annotations.map((ann) => (
                                        <div
                                            key={ann.i}
                                            className="annotation-item"
                                            onClick={() => setSelectedAnnotation(ann)}
                                        >
                                            <div
                                                className="annotation-number"
                                                style={{ backgroundColor: COLORS[ann.c] }}
                                            >
                                                {ann.i + 1}
                                            </div>
                                            <div className="annotation-info">
                                                <div className="annotation-author">
                                                    {resolveUserName(ann.u)}
                                                </div>
                                                {ann.t && (
                                                    <div className="annotation-text">{ann.t}</div>
                                                )}
                                                <div className="annotation-meta">
                                                    <span>{timeAgo(ann.ts)}</span>
                                                    {ann.r.length > 0 && (
                                                        <span>{ann.r.length} {ann.r.length === 1 ? 'reply' : 'replies'}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Text input bar (when adding new annotation) */}
            {mode === 'text-input' && (
                <div className="markup-input-bar">
                    <input
                        ref={noteInputRef}
                        type="text"
                        placeholder="Add a note (optional)..."
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handlePost();
                            }
                        }}
                    />
                    <button className="btn-post" onClick={handlePost}>
                        Post
                    </button>
                    <button className="btn-cancel" onClick={handleCancelDraw}>
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
}

export default MarkupEditor;
