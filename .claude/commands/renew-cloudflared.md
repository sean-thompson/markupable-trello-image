---
description: Restart cloudflared tunnel and return the new dev URL
allowed-tools: Bash, TaskOutput, TaskStop
---

# Renew Cloudflared Tunnel

Execute all steps below autonomously. Do not ask the user questions — just do it and report results.

## Step 1: Verify cloudflared is installed

Run `cloudflared --version`. If the command fails (not found), install it:

```
winget install cloudflare.cloudflared
```

Then verify again. If it still fails, tell the user to install cloudflared manually and stop.

## Step 2: Kill any process using port 3000

Run `netstat -ano | grep ':3000' | grep LISTEN` to find a process on port 3000.

If a PID is found, kill it with `taskkill //PID {pid} //F`.

If nothing is listening on 3000, skip this step.

## Step 3: Start the dev server

Run `npm run watch` in the background using `run_in_background: true` from the project root directory.

## Step 4: Wait for the tunnel URL

Use TaskOutput with `timeout: 45000` to read the background task output. Look for a URL matching the pattern `https://[a-z0-9-]+.trycloudflare.com`.

If the output contains an `EADDRINUSE` error, go back to Step 2 — find and kill the process on port 3000, then restart from Step 3.

## Step 5: Report to the user

Once the tunnel URL is captured, tell the user:

1. The new tunnel URL (prominently displayed)
2. Remind them to update **two things** in the Power-Up admin at https://trello.com/power-ups/69a5778726e3aa6e351000d9/edit :
   - **Iframe Connector URL** — paste the tunnel URL
   - **Allowed Origins** — paste the tunnel URL (needed for image auth)
3. Confirm the dev server is running in the background
