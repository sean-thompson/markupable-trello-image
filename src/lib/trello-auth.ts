/**
 * Build a same-origin proxy URL for authenticated Trello image fetches.
 *
 * Trello download endpoints reject key+token query params (401) and
 * Authorization headers trigger CORS preflight (blocked). So we route
 * through /trello-image on our own server, which adds the OAuth header
 * server-side where CORS doesn't apply.
 */
export function getAuthenticatedUrl(url: string, token: string): string {
    if (!process.env.POWERUP_APP_KEY || !token) return url;

    try {
        const parsed = new URL(url);
        if (parsed.hostname === 'trello.com' || parsed.hostname === 'api.trello.com') {
            return `/trello-image?url=${encodeURIComponent(url)}&token=${encodeURIComponent(token)}`;
        }
    } catch { /* fall through */ }

    return url;
}
