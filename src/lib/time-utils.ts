export function timeAgo(timestampSeconds: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestampSeconds;

    if (diff < 60) return 'just now';
    if (diff < 3600) {
        const m = Math.floor(diff / 60);
        return `${m}m ago`;
    }
    if (diff < 86400) {
        const h = Math.floor(diff / 3600);
        return `${h}h ago`;
    }
    if (diff < 604800) {
        const d = Math.floor(diff / 86400);
        return `${d}d ago`;
    }
    const date = new Date(timestampSeconds * 1000);
    return date.toLocaleDateString();
}
