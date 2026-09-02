# Connect Francis Files to GitHub and Deploy Externally

## Goal
Sync the Francis Files archive codebase to a GitHub repository and make the app runnable on a public URL outside the Lovable editor.

## Recommended hosting
**Cloudflare Pages** is the best fit for this project because the current build stack already targets Cloudflare Workers (via Nitro in `@lovable.dev/vite-tanstack-config`). Vercel and Netlify are viable alternatives, but Cloudflare Pages will require the fewest adapter changes.

## Plan

### 1. Connect GitHub from Lovable
- User opens the **Plus (+) menu in the chat input → GitHub → Connect project**.
- Authorize the Lovable GitHub App.
- Select the GitHub account/organization where the repository will live.
- Create a new repository through Lovable (e.g., `francis-files-archive`).
- Lovable will push the current codebase to that repo and enable bidirectional sync.

### 2. Verify the repository sync
- Confirm the repo contains the full project: `src/`, `package.json`, `vite.config.ts`, `.env`, etc.
- Verify that future edits in Lovable push to GitHub and that GitHub pushes sync back to Lovable.
- Note: `.env` is currently tracked in the repo and contains Supabase configuration. We will review whether it should remain tracked or move to host-only environment variables.

### 3. Prepare for external deployment
- Confirm the project builds locally with `bun run build` or `vite build`.
- Identify required environment variables:
  - Client: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`
  - Server: `SUPABASE_URL`, `SUPABASE_PROJECT_ID`, `SUPABASE_PUBLISHABLE_KEY`
- Document any additional secrets the app relies on (e.g., `LOVABLE_API_KEY`, `APP_USER_CONNECTION_KEY_SECRET`, connector keys, email keys). These are currently injected by Lovable Cloud and will need to be re-created or re-linked on the external host.

### 4. Deploy to Cloudflare Pages
- In Cloudflare dashboard, create a new Pages project and connect the GitHub repo.
- Configure build settings:
  - Build command: `bun run build`
  - Build output directory: `dist` (or the directory Nitro emits; confirm after first build)
- Add the environment variables from step 3 to Cloudflare Pages project settings.
- Trigger a first deploy and inspect the build log.

### 5. Post-deploy verification
- Confirm the live URL loads the login/dashboard page.
- Test sign-in, record search, and a transcription flow to ensure the Supabase backend is reachable.
- Verify that server functions and AI Gateway calls work; if any Lovable-only secrets are missing, surface them and decide whether to migrate those features or supply alternate keys.

### 6. Optional cleanup
- Decide whether to keep `.env` in the repo or move values to the host's environment variables and add `.env` to `.gitignore`.
- Set up a custom domain in Cloudflare Pages if desired.

## Out of scope for this plan
- Migrating off Lovable Cloud/Supabase to a different backend.
- Re-implementing Lovable-only features (AI Gateway, managed email, connectors) that depend on secrets unavailable outside Lovable.

## First step
The first action is the GitHub connection, which must be done by the account owner through the Lovable UI. After that, I can help verify the repo and configure the external host.
