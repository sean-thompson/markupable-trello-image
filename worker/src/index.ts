interface Env {
	POWERUP_APP_KEY: string;
}

const SECURITY_HEADERS: HeadersInit = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': '*',
	'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
	'Content-Security-Policy': "default-src 'none'; img-src *; connect-src *",
	'X-Content-Type-Options': 'nosniff',
};

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: SECURITY_HEADERS });
		}

		if (request.method !== 'GET') {
			return new Response('Method not allowed', { status: 405, headers: SECURITY_HEADERS });
		}

		const { searchParams } = new URL(request.url);
		const url = searchParams.get('url');
		const token = searchParams.get('token');

		if (!url || !token) {
			return new Response('Missing url or token query parameter', { status: 400, headers: SECURITY_HEADERS });
		}

		let parsed: URL;
		try {
			parsed = new URL(url);
		} catch {
			return new Response('Invalid URL', { status: 400, headers: SECURITY_HEADERS });
		}

		if (parsed.hostname !== 'trello.com' && parsed.hostname !== 'api.trello.com') {
			return new Response('Only Trello URLs allowed', { status: 403, headers: SECURITY_HEADERS });
		}

		// Normalize to api.trello.com
		parsed.hostname = 'api.trello.com';

		const upstream = await fetch(parsed.toString(), {
			headers: {
				Authorization: `OAuth oauth_consumer_key="${env.POWERUP_APP_KEY}", oauth_token="${token}"`,
			},
			redirect: 'follow',
		});

		if (!upstream.ok) {
			return new Response('Upstream request failed', { status: 502, headers: SECURITY_HEADERS });
		}

		return new Response(upstream.body, {
			status: 200,
			headers: {
				...SECURITY_HEADERS,
				'Content-Type': upstream.headers.get('Content-Type') || 'application/octet-stream',
				'Cache-Control': 'private, max-age=3600',
			},
		});
	},
} satisfies ExportedHandler<Env>;
