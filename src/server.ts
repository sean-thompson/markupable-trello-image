
import {IncomingMessage, ServerResponse} from 'http';
import * as nodeStatic from 'node-static';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import * as url from 'url';

const file = new(nodeStatic.Server)(path.join(__dirname, '..', 'dist'));

function validateEnvSetup() {
    const requiredEnv: string[] = ['PORT', 'POWERUP_NAME', 'POWERUP_ID', 'POWERUP_APP_KEY', 'CONTEXT_PATH'];
    const actualEnv: string[] = Object.keys(process.env);
    for(const env of requiredEnv) {
        if(!actualEnv.includes(env)) {
            console.error('You are missing Environmental Variables! Make sure you create a .env file or set these natively. Exiting.');
            for(const missingEnv of requiredEnv.filter(e => !actualEnv.includes(e))) {
                console.error(`Missing '${missingEnv}' variable`);
            }
            process.exit(1);
        }
    }
}

function handleTrelloProxy(req: IncomingMessage, res: ServerResponse) {
    const parsed = new url.URL(req.url || '', `http://localhost:${process.env.PORT}`);
    const imageUrl = parsed.searchParams.get('url');
    const token = parsed.searchParams.get('token');

    if (!imageUrl || !token) {
        res.writeHead(400);
        res.end('Missing url or token');
        return;
    }

    let trelloUrl;
    try { trelloUrl = new url.URL(imageUrl); } catch {
        res.writeHead(400);
        res.end('Invalid URL');
        return;
    }
    if (trelloUrl.hostname !== 'trello.com' && trelloUrl.hostname !== 'api.trello.com') {
        res.writeHead(403);
        res.end('Only Trello URLs allowed');
        return;
    }

    trelloUrl.hostname = 'api.trello.com';
    const options = {
        hostname: trelloUrl.hostname,
        path: trelloUrl.pathname + trelloUrl.search,
        headers: {
            'Authorization': `OAuth oauth_consumer_key="${process.env.POWERUP_APP_KEY}", oauth_token="${token}"`
        }
    };

    https.get(options, (proxyRes) => {
        if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
            // Follow one redirect (Trello → S3/CDN)
            https.get(proxyRes.headers.location, (finalRes) => {
                res.writeHead(finalRes.statusCode || 200, {
                    'Content-Type': finalRes.headers['content-type'] || 'application/octet-stream',
                    'Cache-Control': 'private, max-age=3600'
                });
                finalRes.pipe(res);
            }).on('error', () => { res.writeHead(502); res.end('Redirect failed'); });
        } else {
            res.writeHead(proxyRes.statusCode || 200, {
                'Content-Type': proxyRes.headers['content-type'] || 'application/octet-stream',
                'Cache-Control': (proxyRes.statusCode === 200) ? 'private, max-age=3600' : 'no-cache'
            });
            proxyRes.pipe(res);
        }
    }).on('error', () => { res.writeHead(502); res.end('Failed to fetch from Trello'); });
}

console.log('Checking Environmental Variables...');
validateEnvSetup();

console.log('Starting Basic Server...');
console.log("Make sure you've run 'yarn build' to compile the server first");

http.createServer((req: IncomingMessage, res: ServerResponse) => {
    const pathname = (req.url || '').split('?')[0];
    if (pathname === '/trello-image') {
        handleTrelloProxy(req, res);
    } else {
        file.serve(req, res);
    }
}).listen(process.env.PORT);

console.log(`Server Listening on Port ${process.env.PORT}`);
