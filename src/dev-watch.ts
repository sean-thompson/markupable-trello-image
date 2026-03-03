import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({path: path.join(__dirname, '..', '.env')});
import { spawn, ChildProcess } from 'child_process';
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

function waitForTunnel(proc: ChildProcess): Promise<string> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for cloudflared tunnel')), 30000);
        proc.stderr?.on('data', (data: Buffer) => {
            const text = data.toString();
            const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
            if (match) {
                clearTimeout(timeout);
                resolve(match[0]);
            }
        });
        proc.on('error', (err) => { clearTimeout(timeout); reject(err); });
        proc.on('exit', (code) => {
            if (code !== null && code !== 0) { clearTimeout(timeout); reject(new Error(`cloudflared exited with code ${code}`)); }
        });
    });
}

console.log(`⏰ ${getCurrentTime()} Checking Environmental Variables`);
validateEnvSetup();

const port = process.env.PORT || 3000;
console.log(`⏰ ${getCurrentTime()} Creating a tunnel with cloudflared for localhost:${port}...`);

const cloudflaredBin = process.env.CLOUDFLARED_BIN_PATH || 'cloudflared';
const cloudflaredProcess: ChildProcess = spawn(cloudflaredBin, ['tunnel', '--url', `http://localhost:${port}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
});

cloudflaredProcess.stdout?.on('data', (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.log(`cloudflared: ${msg}`);
});

cloudflaredProcess.on('error', (err) => {
    console.error(`⚠ ${getCurrentTime()} Failed to start cloudflared:`, err.message);
    console.error('Make sure cloudflared is installed: winget install cloudflare.cloudflared');
    process.exit(1);
});

waitForTunnel(cloudflaredProcess).then((tunnelUrl: string) => {
    console.log(`✔ ${getCurrentTime()} ${process.env.POWERUP_NAME} tunnel created via ${tunnelUrl}`);
    const managementUrl = process.env.POWERUP_ID === 'UNSPECIFIED' ? 'https://trello.com/power-ups/admin' : `https://trello.com/power-ups/${process.env.POWERUP_ID}/edit`;
    console.log(`⚠ ${getCurrentTime()} Don't forget to update your iFrame Connector URL at ${managementUrl}`);
    console.log(`⚠ ${getCurrentTime()} Also add ${tunnelUrl} to "Allowed Origins" on the same page (needed for image auth)`);

    // Use nodemon to watch for changes to the server-side code
    nodemon({
        exec: `node_modules/.bin/webpack serve --config webpack.config.ts --env POWERUP_URL=${tunnelUrl} --mode=development`,
        ignore: ['src/**/*.spec.ts', 'dev-watch.ts']
    });

    // Stop cloudflared on quit
    nodemon.on('quit', () => {
        console.log(`⚠ ${getCurrentTime()} Stopping cloudflared tunnel...`);
        cloudflaredProcess.kill();
    }).on('unhandledRejection', (error: any) => {
        console.log(`⚠ ${getCurrentTime()} Unhandled Exception`, error);
        console.log('To retry, navigate to the Power-Up root directory and run `yarn watch`.');
    });
}).catch((err: Error) => {
    console.error(`⚠ ${getCurrentTime()} Failed to create tunnel:`, err.message);
    cloudflaredProcess.kill();
    process.exit(1);
});
