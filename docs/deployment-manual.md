# Xplorer Deployment Manual

**Last updated:** 2026-03-25
**Scope:** Everything you must do manually that code cannot automate.

This document covers only manual steps -- account creation, secret configuration, service provisioning, certificate enrollment. For the full technical deployment plan (architecture, code changes, timelines), see `deployment-plan.md`. For the web-specific deploy steps, see `private/web/DEPLOY.md`.

---

## Phase 1: Secrets & Accounts

### 1.1 GitHub Repository Secrets

Go to **GitHub repo > Settings > Secrets and variables > Actions > New repository secret** for each of the following.

- [ ] **`EXTENSION_SIGNING_KEY`**
  - **What:** The 32-byte Ed25519 private key in hex (64 hex characters). Used by the `sign-extension.yml` workflow to cryptographically sign approved marketplace extensions. The corresponding public key must be set in `apps/src-tauri/src/extensions/signing.rs` (`OFFICIAL_PUBLIC_KEY`).
  - **How to generate:** Run `cargo test generate_signing_keypair -- --nocapture` in `apps/src-tauri/`. This prints a fresh keypair. Copy the private key hex as this secret. Update `OFFICIAL_PUBLIC_KEY` in `signing.rs` with the public key bytes.
  - **Where to set:** GitHub repo > Settings > Secrets and variables > Actions

- [ ] **`BLOB_READ_WRITE_TOKEN`**
  - **What:** Vercel Blob storage token for uploading signed extension packages from the CI signing workflow.
  - **How to generate:** Created automatically when you set up a Vercel Blob store (see Phase 2, Step 5b). Copy the token from Vercel Dashboard > your project > Storage > Blob store > Token.
  - **Where to set:** GitHub repo > Settings > Secrets and variables > Actions

- [ ] **`MARKETPLACE_URL`**
  - **What:** The production URL of the marketplace website (e.g., `https://xplorer.app` or `https://xplorer-web.vercel.app`). Used by the signing workflow to call the publish API after signing.
  - **How to generate:** You will know this after deploying to Vercel (Phase 2). Use the Vercel-assigned URL or your custom domain.
  - **Where to set:** GitHub repo > Settings > Secrets and variables > Actions

- [ ] **`ADMIN_API_TOKEN`**
  - **What:** A bearer token used by the signing workflow to authenticate against `POST /api/admin/extensions/publish`. This prevents unauthorized callers from marking extensions as published.
  - **How to generate:** Generate a random 64-character token:
    ```bash
    openssl rand -hex 32
    ```
    You must also set this same value as an environment variable on the Vercel deployment (so the API can validate incoming requests).
  - **Where to set:** GitHub repo > Settings > Secrets and variables > Actions, **and** Vercel project > Settings > Environment Variables (as `ADMIN_API_TOKEN`)

- [ ] **`PRIVATE_REPO_TOKEN`**
  - **What:** A GitHub Personal Access Token (classic) with `repo` scope. Needed by the web CI workflow (`.github/workflows/web.yml` if created) to check out the `private/` submodule during CI.
  - **How to generate:**
    1. Go to https://github.com/settings/tokens
    2. Click **Generate new token (classic)**
    3. Name: `xplorer-ci-submodule-access`
    4. Scopes: check `repo` (full control of private repositories)
    5. Generate and copy the token
  - **Where to set:** GitHub repo > Settings > Secrets and variables > Actions

### 1.2 External Service Accounts

#### Vercel

- [ ] Create a Vercel account at https://vercel.com/signup (if you do not have one)
- [ ] Connect the Xplorer GitHub repository (or the private web submodule repo) to Vercel for auto-deploys
- [ ] The `private/web/` directory contains the Next.js app with a `vercel.json` already configured

#### Neon PostgreSQL

- [ ] Create a Neon account at https://neon.tech (free tier is sufficient to start)
- [ ] Create a new project named `xplorer-web`
- [ ] Copy the connection string -- it will look like:
  ```
  postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
  ```
- [ ] Save this as your `DATABASE_URL` for Vercel environment variables

#### Stripe — NOT NEEDED YET

> **Extension payments via Stripe are an ongoing/future feature.** For now, all extensions are free. If extension authors want to monetize, direct them to [GitHub Sponsors](https://github.com/sponsors). Stripe integration can be added later when the marketplace has enough traffic to justify it.
>
> Leave `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` empty in Vercel env vars. The marketplace will work fine without them — payment-related pages will be hidden.

#### GitHub OAuth App

- [ ] Go to https://github.com/settings/developers
- [ ] Click **New OAuth App**
- [ ] Fill in:
  - **Application name:** `Xplorer`
  - **Homepage URL:** `https://your-domain.vercel.app` (placeholder -- update after deploy)
  - **Authorization callback URL:** `https://your-domain.vercel.app/api/auth/callback/github`
- [ ] Click **Register application**
- [ ] Copy the **Client ID** and generate a **Client Secret**
- [ ] You will update the callback URL once you have your actual Vercel domain

#### GitHub Personal Access Token (Sponsor Checks)

- [ ] Go to https://github.com/settings/tokens
- [ ] Click **Generate new token (classic)**
- [ ] Name: `xplorer-sponsor-check`
- [ ] Scopes: check `read:org`
- [ ] Generate and copy -- this becomes your `GITHUB_PAT` env var
- [ ] Note: This token must belong to the account that receives sponsorships (the account users sponsor)

---

## Phase 2: First Deploy (Marketplace Website)

### Step 1 -- Set up Neon database

- [ ] Log in at https://console.neon.tech
- [ ] Create project `xplorer-web`, region closest to your users
- [ ] Copy the connection string (include `?sslmode=require`)
- [ ] Keep this value ready for Step 3

### Step 2 -- Configure Vercel project

- [ ] Go to https://vercel.com/new
- [ ] Import the repository containing `private/web/`
- [ ] Vercel will auto-detect Next.js from the `vercel.json`
- [ ] Set the **Root Directory** to `private/web` (or wherever the Next.js app lives relative to the repo root)
- [ ] Framework preset: **Next.js** (should be auto-detected)

### Step 3 -- Set all environment variables on Vercel

Go to **Vercel Dashboard > your project > Settings > Environment Variables** and add each of these:

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | Neon connection string from Step 1 | Yes |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` to generate | Yes |
| `NEXTAUTH_URL` | `https://your-project.vercel.app` | Yes |
| `GITHUB_CLIENT_ID` | From Phase 1 GitHub OAuth App | Yes |
| `GITHUB_CLIENT_SECRET` | From Phase 1 GitHub OAuth App | Yes |
| `GITHUB_PAT` | From Phase 1 PAT for sponsor checks | Yes |
| `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` | Yes |
| `BLOB_READ_WRITE_TOKEN` | (see Step 5b below -- set after creating Blob store) | Yes |
| `STRIPE_SECRET_KEY` | From Phase 1 Stripe setup | Only if paid extensions |
| `STRIPE_PUBLISHABLE_KEY` | From Phase 1 Stripe setup | Only if paid extensions |
| `STRIPE_WEBHOOK_SECRET` | (see Step 7 below -- set after creating webhook) | Only if paid extensions |
| `ADMIN_API_TOKEN` | Same value as the GitHub Secret from Phase 1 | Yes |

- [ ] All required variables are set
- [ ] Click **Deploy** (or trigger a redeploy)

### Step 4 -- Create Vercel Blob store

- [ ] In Vercel Dashboard > your project > **Storage** tab
- [ ] Click **Create Database** > select **Blob**
- [ ] Name it `xplorer-extensions`
- [ ] The `BLOB_READ_WRITE_TOKEN` will be auto-added to your project environment variables
- [ ] Also copy this token value to set as a GitHub Secret (Phase 1, `BLOB_READ_WRITE_TOKEN`)

### Step 5 -- Run Prisma migration

From your local machine, with the Neon `DATABASE_URL` available:

```bash
cd private/web

# Option A: Push schema directly (no migration history -- fine for first deploy)
export DATABASE_URL="postgresql://..."
pnpm db:push

# Option B: Create a proper migration (recommended for production)
export DATABASE_URL="postgresql://..."
pnpm db:migrate
```

- [ ] Schema pushed successfully (no errors)

### Step 6 -- Seed initial data

```bash
cd private/web
export DATABASE_URL="postgresql://..."
pnpm db:seed
```

This seeds categories and any initial data the marketplace needs.

- [ ] Seed completed successfully

### Step 7 -- Make yourself admin

- [ ] Sign in to the deployed site via GitHub OAuth (this creates your user record)
- [ ] Then promote yourself to admin:

```bash
# Option A: Prisma Studio (visual)
cd private/web
export DATABASE_URL="postgresql://..."
pnpm db:studio
# Find your user in the User table, change `role` to `ADMIN`

# Option B: Direct SQL
psql "$DATABASE_URL" -c "UPDATE users SET role = 'ADMIN' WHERE email = 'your@email.com';"
```

- [ ] Your account now has ADMIN role

### Step 8 -- Set up Stripe webhook (if using paid extensions)

- [ ] Go to https://dashboard.stripe.com/webhooks
- [ ] Click **Add endpoint**
- [ ] Set URL to: `https://your-project.vercel.app/api/webhooks/stripe`
- [ ] Select events:
  - `checkout.session.completed`
  - `account.updated` (for Connect onboarding)
- [ ] Click **Add endpoint**
- [ ] Copy the **Signing secret** (starts with `whsec_`)
- [ ] Add it to Vercel env vars as `STRIPE_WEBHOOK_SECRET`
- [ ] Redeploy (push a commit or use `npx vercel --prod`)

### Step 9 -- Update GitHub OAuth callback URL

- [ ] Go back to https://github.com/settings/developers
- [ ] Edit your Xplorer OAuth App
- [ ] Update **Homepage URL** to your actual Vercel URL
- [ ] Update **Authorization callback URL** to `https://your-actual-domain/api/auth/callback/github`
- [ ] Save

### Step 10 -- Verify deployment

- [ ] Visit the deployed URL -- landing page loads
- [ ] Click **Sign in** -- GitHub OAuth flow works
- [ ] Check `/admin` route -- accessible with your admin account
- [ ] Upload a test extension (if submit endpoint is ready) or verify API responds at `/api/extensions`
- [ ] Check Prisma Studio (`pnpm db:studio`) -- categories are seeded, your user exists

---

## Phase 3: Code Signing (Desktop App) — OPTIONAL

> **You can skip this entire phase.** The app works fine without code signing — users just click through an OS warning dialog ("unidentified developer" on macOS, SmartScreen on Windows). Many open-source apps ship unsigned. Only add signing later if users complain or you want App Store distribution.

The release workflow already builds and uploads to GitHub Releases on `v*` tag push without any signing. The instructions below are for when/if you decide to add it.

### 3.1 macOS Code Signing & Notarization

**Prerequisites:**
- [ ] Apple Developer Program membership ($99/year) -- enroll at https://developer.apple.com/programs/

**Create Developer ID Application certificate:**
- [ ] Open **Keychain Access** on your Mac
- [ ] Go to **Keychain Access > Certificate Assistant > Request a Certificate from a Certificate Authority**
- [ ] Save the CSR to disk
- [ ] Go to https://developer.apple.com/account/resources/certificates/add
- [ ] Select **Developer ID Application**
- [ ] Upload your CSR and download the certificate
- [ ] Double-click the `.cer` file to install it into your Keychain

**Export the certificate for CI:**
- [ ] In Keychain Access, find the "Developer ID Application: Your Name" certificate
- [ ] Right-click > **Export Items** > save as `.p12` file with a strong password
- [ ] Base64-encode the `.p12` for use in CI:
  ```bash
  base64 -i Certificates.p12 -o certificate-base64.txt
  ```

**Set GitHub Secrets:**
- [ ] `APPLE_CERTIFICATE` -- the base64-encoded `.p12` content (from `certificate-base64.txt`)
- [ ] `APPLE_CERTIFICATE_PASSWORD` -- the password you set when exporting the `.p12`
- [ ] `APPLE_SIGNING_IDENTITY` -- the full name of the certificate, e.g., `Developer ID Application: Your Name (TEAM_ID)`
- [ ] `APPLE_ID` -- your Apple ID email (for notarization)
- [ ] `APPLE_PASSWORD` -- an app-specific password for notarization:
  1. Go to https://appleid.apple.com/account/manage
  2. Under **Sign-In and Security**, click **App-Specific Passwords**
  3. Generate a new password named `xplorer-notarization`
  4. Copy the generated password
- [ ] `APPLE_TEAM_ID` -- your 10-character Apple Developer Team ID (visible at https://developer.apple.com/account > Membership Details)

**Update the release workflow:**

The `tauri-apps/tauri-action` supports code signing via these environment variables. You need to add them to the macOS build steps in `.github/workflows/release.yml`. The Tauri action will automatically handle signing and notarization when these env vars are present.

### 3.2 Windows Code Signing (Authenticode)

**Get a code signing certificate:**
- [ ] Purchase an Authenticode code signing certificate from a trusted CA:
  - **DigiCert:** https://www.digicert.com/signing/code-signing-certificates (recommended, ~$474/year)
  - **Sectigo:** https://sectigo.com/ssl-certificates-tls/code-signing (~$200/year for OV)
  - **SSL.com:** https://www.ssl.com/certificates/code-signing/ (~$200/year for OV)
  - Note: EV certificates provide immediate SmartScreen reputation but require hardware tokens (USB). OV certificates build reputation over time through downloads.

**Export the certificate for CI:**
- [ ] You will receive a `.pfx` or `.p12` file from your CA
- [ ] Base64-encode it:
  ```bash
  base64 -i certificate.pfx -o win-certificate-base64.txt
  ```

**Set GitHub Secrets:**
- [ ] `WINDOWS_CERTIFICATE` -- the base64-encoded `.pfx` content
- [ ] `WINDOWS_CERTIFICATE_PASSWORD` -- the password for the `.pfx` file

**Update the release workflow:**

The `tauri-apps/tauri-action` supports Windows signing when these env vars are set on the Windows build step. Tauri will use SignTool automatically.

### 3.3 Linux

Linux builds (.deb, .AppImage) do not require code signing for distribution. Optional: GPG-sign your `.deb` packages if you plan to host an APT repository.

---

## Phase 4: DNS & Domain

### 4.1 Register/configure your domain

- [ ] Register a domain (e.g., `xplorer.app`) if you do not already have one
- [ ] Recommended registrars: Cloudflare Registrar, Namecheap, Google Domains

### 4.2 Connect domain to Vercel

- [ ] Go to **Vercel Dashboard > your project > Settings > Domains**
- [ ] Click **Add** and enter your domain (e.g., `xplorer.app`)
- [ ] Vercel will display DNS records to configure:
  - For apex domain (`xplorer.app`): Add an `A` record pointing to `76.76.21.21`
  - For `www` subdomain: Add a `CNAME` record pointing to `cname.vercel-dns.com`
- [ ] Go to your domain registrar's DNS settings and add those records
- [ ] Wait for DNS propagation (usually 5-60 minutes, up to 48 hours)
- [ ] Vercel will auto-provision an SSL certificate via Let's Encrypt

### 4.3 Update all references after domain change

After your custom domain is live, update these:

- [ ] **Vercel env vars:**
  - `NEXTAUTH_URL` -> `https://xplorer.app`
  - `NEXT_PUBLIC_APP_URL` -> `https://xplorer.app`
- [ ] **GitHub OAuth App** (https://github.com/settings/developers):
  - Homepage URL -> `https://xplorer.app`
  - Callback URL -> `https://xplorer.app/api/auth/callback/github`
- [ ] **Stripe webhook** (if configured):
  - Update endpoint URL to `https://xplorer.app/api/webhooks/stripe`
- [ ] **GitHub Secret:**
  - Update `MARKETPLACE_URL` to `https://xplorer.app`
- [ ] **Redeploy** after env var changes (push a commit or trigger manually)

---

## Phase 5: Monitoring & Observability

### 5.1 Error Tracking (Sentry)

- [ ] Create a Sentry account at https://sentry.io/signup/
- [ ] Create a new project > select **Next.js**
- [ ] Install the SDK (follow Sentry's Next.js setup wizard):
  ```bash
  cd private/web
  npx @sentry/wizard@latest -i nextjs
  ```
- [ ] Add the `SENTRY_DSN` environment variable to Vercel
- [ ] Optionally set up a second Sentry project for the Tauri desktop app (Rust + frontend)

### 5.2 Vercel Analytics

- [ ] Go to **Vercel Dashboard > your project > Analytics** tab
- [ ] Click **Enable** (available on Hobby plan and above)
- [ ] Web Vitals and traffic analytics will start collecting automatically
- [ ] Optionally enable **Speed Insights** for per-page performance data

### 5.3 Uptime Monitoring

- [ ] Set up a free uptime monitor to alert you when the marketplace goes down:
  - **Better Uptime:** https://betteruptime.com (free tier: 5 monitors, 3-min checks)
  - **UptimeRobot:** https://uptimerobot.com (free tier: 50 monitors, 5-min checks)
  - **Checkly:** https://www.checklyhq.com (free tier: 5 checks)
- [ ] Monitor these endpoints:
  - `GET https://your-domain/` -- marketing site loads (expect 200)
  - `GET https://your-domain/api/extensions` -- API is responsive (expect 200)
- [ ] Configure alert notifications (email, Slack, Discord, etc.)

### 5.4 Database Monitoring

- [ ] Neon Dashboard (https://console.neon.tech) provides built-in monitoring:
  - Connection count
  - Query performance
  - Storage usage
- [ ] Set up Neon's email alerts for approaching plan limits
- [ ] Review the **Monitoring** tab periodically after launch

### 5.5 Stripe Monitoring (if using paid extensions)

- [ ] Enable Stripe Radar for fraud detection (auto-enabled on live mode)
- [ ] Set up Stripe email alerts for:
  - Failed payments
  - Disputes/chargebacks
  - Payout failures
- [ ] Go to https://dashboard.stripe.com/settings/emails to configure

---

## Quick Reference: All Secrets & Environment Variables

### GitHub Repository Secrets (Settings > Secrets > Actions)

| Secret | Purpose | Generated How |
|--------|---------|---------------|
| `EXTENSION_SIGNING_KEY` | Ed25519 private key for extension signing | Already exists (see Phase 1.1) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob upload from CI | From Vercel Blob store setup |
| `MARKETPLACE_URL` | Production URL for publish callback | Your Vercel/custom domain |
| `ADMIN_API_TOKEN` | Auth token for publish endpoint | `openssl rand -hex 32` |
| `PRIVATE_REPO_TOKEN` | PAT for submodule checkout in CI | GitHub Settings > Tokens |
| `APPLE_CERTIFICATE` | Base64-encoded macOS signing cert | Export from Keychain Access |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the .p12 cert | Set during export |
| `APPLE_SIGNING_IDENTITY` | Certificate name | From Keychain, e.g. `Developer ID Application: ...` |
| `APPLE_ID` | Apple ID email | Your Apple Developer email |
| `APPLE_PASSWORD` | App-specific password | https://appleid.apple.com |
| `APPLE_TEAM_ID` | 10-char team ID | https://developer.apple.com/account |
| `WINDOWS_CERTIFICATE` | Base64-encoded Windows signing cert | From your CA (DigiCert, Sectigo, etc.) |
| `WINDOWS_CERTIFICATE_PASSWORD` | Password for the .pfx cert | Set by the CA or during export |

### Vercel Environment Variables (Project > Settings > Environment Variables)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Session encryption secret |
| `NEXTAUTH_URL` | Public app URL |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret |
| `GITHUB_PAT` | PAT for sponsor status checks |
| `NEXT_PUBLIC_APP_URL` | Public app URL (client-side) |
| `BLOB_READ_WRITE_TOKEN` | Auto-added by Vercel Blob store |
| `STRIPE_SECRET_KEY` | Stripe API secret |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `ADMIN_API_TOKEN` | Same as GitHub Secret -- for validating CI publish calls |

---

## Post-Deploy Verification Checklist

Run through this after completing all phases:

- [ ] Marketplace website loads at your domain
- [ ] GitHub OAuth sign-in works end to end
- [ ] Admin dashboard accessible at `/admin`
- [ ] Categories are seeded (visible in marketplace browse)
- [ ] Extension upload and download works (Vercel Blob)
- [ ] `sign-extension.yml` workflow runs when triggered via `repository_dispatch`
- [ ] Signed extensions pass verification in the desktop app (`signing.rs`)
- [ ] Desktop release builds for all 3 platforms (push a `v*` tag to test)
- [ ] macOS build is signed and notarized (no Gatekeeper warning)
- [ ] Windows build is signed (no SmartScreen warning)
- [ ] Stripe webhook receives events (check Stripe Dashboard > Webhooks > logs)
- [ ] Uptime monitor is active and sending test alerts
- [ ] Sentry receives test errors (throw a test error, confirm it appears)

---

## Important Security Notes

1. **Rotate the Ed25519 signing key:** The current private key is visible in the `signing.rs` source code (in a comment and in test constants). After setting it as a GitHub Secret, remove all traces from source code. If you consider it compromised, generate a new key pair and update `OFFICIAL_PUBLIC_KEY` in `signing.rs`.

2. **Never commit secrets:** Do not add `.env` files, certificates, or private keys to version control. The `.gitignore` should already exclude `.env*` files.

3. **Use Stripe test mode first:** Set up everything with `sk_test_` / `pk_test_` keys. Switch to live keys (`sk_live_` / `pk_live_`) only after end-to-end testing is complete.

4. **Restrict the `PRIVATE_REPO_TOKEN` PAT:** If possible, use a fine-grained PAT scoped only to the private submodule repository instead of a classic PAT with full `repo` scope.

5. **Certificate renewal:** Apple Developer certificates and Authenticode certificates expire (typically 1-5 years). Set calendar reminders for renewal to avoid broken release builds.
