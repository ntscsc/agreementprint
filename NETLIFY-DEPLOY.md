# Netlify deployment

This is a Next.js application with server API routes. Deploy through a Git-connected Netlify project so Netlify runs the build and automatically applies its Next.js adapter. The source ZIP is not a static drag-and-drop website.

## Prepare and verify

On Windows, run from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-netlify.ps1
```

This creates `output/stampvendor-netlify-source.zip` and checks `npm ci --include=optional` and `npm run build` in a separate temporary directory without local `.env` files. A failed check exits with an error; use the ZIP only after both checks pass. The temporary directory remains available for inspection. The ZIP contains source, the lockfile and deployment configuration, including new application files. It excludes dependencies, generated builds, local secrets and temporary browser data.

## Netlify settings

- Base directory: repository root (the directory containing `package.json`).
- Build command: `npm run build`.
- Publish directory: `.next`.
- Node.js: 22, as set in `netlify.toml` and `.nvmrc`.
- Use the automatic Next.js adapter; remove any old manually pinned Next.js adapter.
- Leave `NEXT_BUILD_DIR` unset so the build output matches `.next`.
- Install development dependencies and optional dependencies; do not set `NPM_FLAGS=--omit=dev` or `NPM_CONFIG_PRODUCTION=true`.

If using the archive, extract it at the Git repository root and commit the application files, including new files and `package-lock.json`. Review the commit to exclude local `.env` files. Clear Netlify's build cache for the first deployment of this prepared version.

## Production environment

Copy the variable names from `.env.example` into Netlify's environment settings and enter the actual values privately. Server credentials must be available to Functions at runtime. Set `APP_URL` to the final HTTPS origin. Configure Firebase Admin credentials, Supabase storage settings, and the credentials for the payment gateway(s) you enable. Never put private credentials in `NEXT_PUBLIC_` variables.

The existing `jwks-rsa` override in `package.json` and the matching lockfile prevent the previously documented Firebase Admin `ERR_REQUIRE_ESM` startup failure. Keep both files together. Secret scanning remains enabled; the configuration only excludes three non-secret configuration labels.

Authorize the deployed domain in Firebase Authentication, apply the current Firestore rules/indexes to the intended project, and configure the appropriate payment webhook URLs. These are separate service settings; a successful build does not validate them.

## Verify after deployment

1. Open the homepage and check browser assets load.
2. Request `/api/custom-agreements` without signing in: expect JSON with HTTP 401, not an HTML 500.
3. Verify Google sign-in, customer order/request lists, and authorized admin access.
4. Verify private uploads and PDF downloads with a test account.
5. Verify the configured payment provider in its test environment before accepting live payments.

Reference: https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/
