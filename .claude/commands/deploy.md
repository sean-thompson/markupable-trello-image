---
description: Deploy frontend (GitHub Pages) and/or image proxy (Cloudflare Worker)
allowed-tools: Bash, Read, Glob, Grep, AskUserQuestion
---

# Deploy

Execute all steps below. Report progress as you go.

## Step 1: Check Cloudflare Worker for changes

1. Run `git diff -- worker/` to check for uncommitted changes in the `worker/` directory.
2. Run `git log origin/main..HEAD -- worker/` to check for unpushed commits touching `worker/`.
3. If either produces output, tell the user there are Worker changes to deploy, then run:
   ```
   cd worker && npx wrangler deploy
   ```
   Report the result (success or failure).
4. If both are clean, report "Cloudflare Worker: nothing to deploy."

## Step 2: Check GitHub Pages (frontend) for changes

1. Run `git status --short` to check for uncommitted/untracked changes.
2. Run `git log origin/main..HEAD` to check for unpushed commits.
3. **If there are uncommitted changes:**
   - Show the user the list of changed files.
   - Ask the user for a commit message (suggest one based on the changes).
   - Stage the relevant files and commit using a heredoc to safely pass the message:
     ```
     git commit -m "$(cat <<'EOF'
     <message here>
     EOF
     )"
     ```
   - Then push.
4. **If there are unpushed commits but no uncommitted changes:**
   - Show the user the unpushed commits.
   - Push to origin/main.
5. **If everything is clean and up-to-date:**
   - Report "GitHub Pages: nothing to deploy."

## Step 3: Offer release tagging

After completing Steps 1 and 2 (whether or not anything was deployed):

1. Get the latest tag: `git tag --sort=-v:refname | head -1`
2. Show commits since that tag: `git log <latest-tag>..HEAD --oneline`
3. If there are commits since the last tag, suggest the next semver version:
   - **patch** for bug fixes and minor tweaks
   - **minor** for new features or meaningful enhancements
   - **major** for breaking changes
4. Ask the user if they want to tag a release and which version to use.
5. If they agree, create and push the tag:
   ```
   git tag <version>
   git push origin <version>
   ```

## Step 4: Summary

Report a final summary of what was deployed:
- Cloudflare Worker: deployed / nothing to do
- GitHub Pages: pushed / nothing to do
- Tag: created vX.Y.Z / skipped
