# Cloudflare Pages 404 Error - Root Cause Analysis & Fix

## Problem Summary

The Cloudflare Pages deployment at https://gitdiscover-web.pages.dev/ was returning a 404 error despite successful GitHub Actions deployments.

## Root Cause

The GitHub Actions workflow was deploying the raw Next.js build output (`apps/web/.next`) directly to Cloudflare Pages. This caused the 404 error because:

1. **Next.js uses Server-Side Rendering (SSR)**: The application has async server components:
   - `app/layout.tsx` - Uses `async function RootLayout()` with `getCurrentUser()`
   - `app/page.tsx` - Uses `async function HomePage()` with API calls
   - Server-side data fetching with `apiGetServer()`

2. **Cloudflare Pages doesn't understand `.next` directory**: The `.next` directory contains:
   - Server-side JavaScript bundles (`.js` files in `.next/server/`)
   - Build manifests and metadata
   - Not static HTML/CSS/JS that Cloudflare Pages can serve directly

3. **Missing Cloudflare Workers adapter**: While `@cloudflare/next-on-pages` was installed in the root `package.json`, it wasn't being used in the build process.

## Solution Implemented

### 1. Updated `apps/web/next.config.mjs`
Added `@cloudflare/next-on-pages` integration:

```javascript
import { setupDevPlatform } from "@cloudflare/next-on-pages/next-dev";

// Setup dev platform for local development
if (process.env.NODE_ENV === "development") {
  await setupDevPlatform();
}
```

This enables local development with Cloudflare Workers compatibility.

### 2. Updated `apps/web/package.json`
Added new build script:

```json
"pages:build": "npx @cloudflare/next-on-pages"
```

This script converts the Next.js build into Cloudflare Workers-compatible format.

### 3. Updated `.github/workflows/deploy.yml`
Modified the deployment workflow:

**Before:**
```yaml
- name: Build web app
  run: |
    npm run prisma:generate
    npm run build -w @gitdiscover/shared
    npm run build -w @gitdiscover/web
    rm -rf apps/web/.next/cache

- name: Deploy to Cloudflare Pages
  command: pages deploy apps/web/.next --project-name=gitdiscover-web
```

**After:**
```yaml
- name: Build web app
  run: |
    npm run prisma:generate
    npm run build -w @gitdiscover/shared
    npm run build -w @gitdiscover/web
  env:
    NEXT_PUBLIC_APP_URL: https://gitdiscover.org
    NEXT_PUBLIC_API_URL: https://api.gitdiscover.org
    NEXT_PUBLIC_API_BASE_URL: https://api.gitdiscover.org/v1

- name: Build for Cloudflare Pages
  run: npm run pages:build -w @gitdiscover/web
  env:
    NEXT_PUBLIC_APP_URL: https://gitdiscover.org
    NEXT_PUBLIC_API_URL: https://api.gitdiscover.org
    NEXT_PUBLIC_API_BASE_URL: https://api.gitdiscover.org/v1

- name: Deploy to Cloudflare Pages
  command: pages deploy apps/web/.vercel/output/static --project-name=gitdiscover-web
```

## How @cloudflare/next-on-pages Works

The `@cloudflare/next-on-pages` package:

1. Takes the standard Next.js build output (`.next` directory)
2. Converts server-side functions to Cloudflare Workers
3. Generates a `.vercel/output/static` directory with:
   - Static assets (HTML, CSS, JS, images)
   - `_worker.js` - Cloudflare Worker that handles server-side logic
   - Routing configuration compatible with Cloudflare Pages

This allows Next.js SSR features to work on Cloudflare's edge network.

## Verification Steps

After pushing the changes:

1. GitHub Actions will trigger automatically on push to `main`
2. The workflow will:
   - Build the Next.js app normally
   - Run `@cloudflare/next-on-pages` to generate Cloudflare-compatible output
   - Deploy `apps/web/.vercel/output/static` to Cloudflare Pages
3. Visit https://gitdiscover-web.pages.dev/ - should now work correctly

## Technical Details

### Files Modified
- `/Volumes/SSD/skills/server-ops/vps/107.174.42.198/heavy-tasks/gitdiscover.org/apps/web/next.config.mjs`
- `/Volumes/SSD/skills/server-ops/vps/107.174.42.198/heavy-tasks/gitdiscover.org/apps/web/package.json`
- `/Volumes/SSD/skills/server-ops/vps/107.174.42.198/heavy-tasks/gitdiscover.org/.github/workflows/deploy.yml`

### Commit
```
cc743e1 fix: Configure Next.js for Cloudflare Pages deployment
```

### Why VPS Deployment Works
The VPS deployment at https://gitdiscover.org works because:
- It runs the full Next.js server with Node.js runtime
- Uses `next start` which serves the `.next` directory correctly
- Has access to full Node.js APIs and server-side features

### Why Cloudflare Pages Needed Special Configuration
Cloudflare Pages:
- Runs on Cloudflare Workers (V8 isolates, not Node.js)
- Requires static files or Workers-compatible JavaScript
- Needs adapter to convert Next.js server functions to Workers format

## Next Steps

1. Push the commit to trigger deployment:
   ```bash
   git push origin main
   ```

2. Monitor GitHub Actions: https://github.com/[repo]/actions

3. Verify deployment at: https://gitdiscover-web.pages.dev/

4. Check Cloudflare Pages dashboard for deployment logs if issues occur

## References

- [@cloudflare/next-on-pages documentation](https://github.com/cloudflare/next-on-pages)
- [Cloudflare Pages documentation](https://developers.cloudflare.com/pages/)
- [Next.js deployment documentation](https://nextjs.org/docs/deployment)
