/**
 * Build an authenticated Trello image URL.
 *
 * When TRELLO_IMAGE_PROXY_URL is set (production on GitHub Pages), routes
 * through the Cloudflare Worker proxy which adds OAuth headers and returns
 * the image with CORS headers — required for canvas cross-origin usage.
 *
 * When not set (local dev), appends key+token query params directly.
 */
export function getAuthenticatedUrl(url: string, token: string): string {
    if (!token) return url;

    try {
        const parsed = new URL(url);
        if (parsed.hostname !== 'trello.com' && parsed.hostname !== 'api.trello.com') {
            return url;
        }
    } catch {
        return url;
    }

    // Production: route through Cloudflare Worker proxy
    if (process.env.TRELLO_IMAGE_PROXY_URL) {
        return `${process.env.TRELLO_IMAGE_PROXY_URL}?url=${encodeURIComponent(url)}&token=${encodeURIComponent(token)}`;
    }

    // Local dev: append key+token directly
    if (!process.env.POWERUP_APP_KEY || process.env.POWERUP_APP_KEY === 'UNSPECIFIED') return url;

    const parsed = new URL(url);
    parsed.searchParams.set('key', process.env.POWERUP_APP_KEY);
    parsed.searchParams.set('token', token);
    return parsed.toString();
}
