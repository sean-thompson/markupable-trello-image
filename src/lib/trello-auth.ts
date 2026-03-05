/**
 * Build an authenticated Trello image URL.
 *
 * Appends key+token query params for Trello REST API URLs so that
 * images can be loaded directly without a server-side proxy.
 */
export function getAuthenticatedUrl(url: string, token: string): string {
    if (!process.env.POWERUP_APP_KEY || process.env.POWERUP_APP_KEY === 'UNSPECIFIED' || !token) return url;

    try {
        const parsed = new URL(url);
        if (parsed.hostname === 'trello.com' || parsed.hostname === 'api.trello.com') {
            parsed.searchParams.set('key', process.env.POWERUP_APP_KEY);
            parsed.searchParams.set('token', token);
            return parsed.toString();
        }
    } catch { /* fall through */ }

    return url;
}
