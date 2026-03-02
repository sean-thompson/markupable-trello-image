import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({path: path.join(__dirname, '..', '.env')});
import { spawn, ChildProcess } from 'child_process';
import * as http from 'http';
import * as nodemon from 'nodemon';

function getCurrentTime(): string {
    const now = new Date();
    const hours = `${now.getHours() < 10 ? '0' : ''}${now.getHours()}`;
    const mins = `${now.getMinutes() < 10 ? '0' : ''}${now.getMinutes()}`;
    return `${hours}:${mins}`;
}

function validateEnvSetup() {
    const requiredEnv: string[] = ['PORT', 'POWERUP_NAME', 'POWERUP_ID', 'POWERUP_APP_KEY', 'CONTEXT_PATH'];
    const actualEnv: string[] = Object.keys(process.env);
    for(const env of requiredEnv) {
        if(!actualEnv.includes(env)) {
            console.error('You are missing Environmental Variables! Make sure you create a .env file. Exiting.');
            console.error('To retry, navigate to the Power-Up root directory and run `yarn watch`.');
            process.exit(1);
        }
    }
}

function getTunnelUrl(): Promise<string> {
    return new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    const tunnel = parsed.tunnels.find((t: any) => t.proto === 'https') || parsed.tunnels[0];
                    if (tunnel) {
                        resolve(tunnel.public_url);
                    } else {
                        reject(new Error('No tunnels found'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function waitForTunnel(retries = 30, delay = 1000): Promise<string> {
    for (let i = 0; i < retries; i++) {
        try {
            return await getTunnelUrl();
        } catch {
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw new Error('Timed out waiting for ngrok tunnel');
}

console.log(`⏰ ${getCurrentTime()} Checking Environmental Variables`);
validateEnvSetup();

const port = process.env.PORT || 3000;
console.log(`⏰ ${getCurrentTime()} Creating a tunnel with ngrok for localhost:${port}...`);

const ngrokBin = process.env.NGROK_BIN_PATH || path.join(__dirname, '..', 'node_modules', 'ngrok', 'bin', 'ngrok');
const ngrokProcess: ChildProcess = spawn(ngrokBin, ['http', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
});

ngrokProcess.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.error(`ngrok stderr: ${msg}`);
});

ngrokProcess.on('error', (err) => {
    console.error(`⚠ ${getCurrentTime()} Failed to start ngrok:`, err.message);
    process.exit(1);
});

ngrokProcess.on('exit', (code) => {
    if (code !== null && code !== 0) {
        console.error(`⚠ ${getCurrentTime()} ngrok exited with code ${code}`);
        process.exit(1);
    }
});

waitForTunnel().then((tunnelUrl: string) => {
    console.log(`✔ ${getCurrentTime()} ${process.env.POWERUP_NAME} tunnel created via ${tunnelUrl}`);
    const managementUrl = process.env.POWERUP_ID === 'UNSPECIFIED' ? 'https://trello.com/power-ups/admin' : `https://trello.com/power-ups/${process.env.POWERUP_ID}/edit`;
    console.log(`⚠ ${getCurrentTime()} Don't forget to update your iFrame Connector URL at ${managementUrl}`);

    // Use nodemon to watch for changes to the server-side code
    nodemon({
        exec: `node_modules/.bin/webpack serve --config webpack.config.ts --env POWERUP_URL=${tunnelUrl} --mode=development`,
        ignore: ['src/**/*.spec.ts', 'dev-watch.ts']
    });

    // Stop ngrok on kill
    nodemon.on('quit', () => {
        console.log(`⚠ ${getCurrentTime()} Stopping ngrok tunnel...`);
        ngrokProcess.kill();
    }).on('unhandledRejection', (error: any) => {
        console.log(`⚠ ${getCurrentTime()} Unhandled Exception`, error);
        console.log('To retry, navigate to the Power-Up root directory and run `yarn watch`.');
    });
}).catch((err: Error) => {
    console.error(`⚠ ${getCurrentTime()} Failed to create tunnel:`, err.message);
    ngrokProcess.kill();
    process.exit(1);
});
