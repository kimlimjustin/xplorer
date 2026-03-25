# Xplorer Deployment Manual

**Last updated:** 2026-03-25
**Scope:** Everything you must do manually that code cannot automate.

This document covers only manual steps -- account creation, secret configuration, service provisioning, certificate enrollment. For the full technical deployment plan (architecture, code changes, timelines), see `deployment-plan.md`. For the web-specific deploy steps, see `apps/web/DEPLOY.md`.

---

## Phase 1: Secrets & Accounts

### 1.1 All Secrets — Where Each One Goes

There are **two places** you set secrets:

| Location | URL | What goes here |
|----------|-----|----------------|
| **GitHub `xplorer` repo** | `github.com/kimlimjustin/xplorer` > Settings > Secrets and variables > Actions | Secrets used by CI workflows (`.github/workflows/*.yml`) |
| **Vercel project** | `vercel.com/<your-team>/xplorer-web` > Settings > Environment Variables | Secrets used by the Next.js marketplace website at runtime |

Some secrets need to be in **both places** (marked below).

---

#### Secrets for GitHub `xplorer` repo (Actions secrets)

| Secret name | Value | Used by | Status |
|-------------|-------|---------|--------|
| `EXTENSION_SIGNING_KEY` | Ed25519 private key hex (64 chars). Generated via `cargo test generate_signing_keypair -- --ignored --nocapture` | `sign-extension.yml` | [x] Done |
| `MARKETPLACE_URL` | Your marketplace URL, e.g. `https://xplorer-web.vercel.app` | `sign-extension.yml` | [x] Done |
| `ADMIN_API_TOKEN` | Random token: `openssl rand -hex 32`. **Also set on Vercel** (see below) | `sign-extension.yml` | [x] Done |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token. Get it after creating Blob store (Phase 2, Step 4) | `sign-extension.yml` | [ ] After Phase 2 |

- [ ] Set `EXTENSION_SIGNING_KEY` as a GitHub Actions secret
  **Where:** `github.com/kimlimjustin/xplorer` > Settings > Secrets and variables > Actions > New repository secret
  **Status:** Already done.

- [ ] Set `MARKETPLACE_URL` as a GitHub Actions secret
  **Where:** `github.com/kimlimjustin/xplorer` > Settings > Secrets and variables > Actions > New repository secret
  **Status:** Already done.

- [ ] Set `ADMIN_API_TOKEN` as a GitHub Actions secret
  **Where:** `github.com/kimlimjustin/xplorer` > Settings > Secrets and variables > Actions > New repository secret
  **Important:** This same value must ALSO be set as a Vercel environment variable (see Vercel section below). The CI workflow uses it to authenticate publish requests to the marketplace API.
  **Status:** Already done.

- [ ] Set `BLOB_READ_WRITE_TOKEN` as a GitHub Actions secret
  **Where:** `github.com/kimlimjustin/xplorer` > Settings > Secrets and variables > Actions > New repository secret
  **Value:** Copy from Vercel after completing Phase 2, Step 4 (Vercel Blob store creation).

---

#### Secrets for Vercel project (environment variables)

| Variable name | Value | How to get it |
|---------------|-------|---------------|
| `DATABASE_URL` | Neon PostgreSQL connection string | Create in Phase 2, Step 1 |
| `NEXTAUTH_SECRET` | Random: `openssl rand -base64 32` | Generate locally |
| `NEXTAUTH_URL` | `https://your-project.vercel.app` | Your Vercel URL |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID | Create in Phase 1.2 |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret | Create in Phase 1.2 |
| `GITHUB_PAT` | PAT with `read:org` scope (for sponsor checks) | Create in Phase 1.2 |
| `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` | Same as NEXTAUTH_URL |
| `BLOB_READ_WRITE_TOKEN` | Auto-set when you create Vercel Blob store | Phase 2, Step 4 |
| `ADMIN_API_TOKEN` | **Same value** as the GitHub secret above | Copy from above |
| `STRIPE_SECRET_KEY` | *(leave empty for now -- future feature)* | -- |
| `STRIPE_PUBLISHABLE_KEY` | *(leave empty for now -- future feature)* | -- |
| `STRIPE_WEBHOOK_SECRET` | *(leave empty for now -- future feature)* | -- |

- [ ] Set `DATABASE_URL` on Vercel
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables
  **Value:** The Neon PostgreSQL connection string from Phase 2, Step 1. Looks like: `postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`

- [ ] Set `NEXTAUTH_SECRET` on Vercel
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables
  **Value:** Generate locally by running `openssl rand -base64 32` in your terminal. Paste the output.

- [ ] Set `NEXTAUTH_URL` on Vercel
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables
  **Value:** `https://your-project.vercel.app` (replace with your actual Vercel domain; update again in Phase 4 if you add a custom domain)

- [ ] Set `GITHUB_CLIENT_ID` on Vercel
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables
  **Value:** The Client ID from the GitHub OAuth App you create in Phase 1.2.

- [ ] Set `GITHUB_CLIENT_SECRET` on Vercel
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables
  **Value:** The Client Secret from the GitHub OAuth App you create in Phase 1.2.

- [ ] Set `GITHUB_PAT` on Vercel
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables
  **Value:** The classic PAT with `read:org` scope that you create in Phase 1.2.

- [ ] Set `NEXT_PUBLIC_APP_URL` on Vercel
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables
  **Value:** Same as `NEXTAUTH_URL` (e.g. `https://your-project.vercel.app`). This is exposed to the browser (the `NEXT_PUBLIC_` prefix makes it client-side).

- [ ] Set `BLOB_READ_WRITE_TOKEN` on Vercel
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables
  **Value:** This is auto-added when you create the Vercel Blob store in Phase 2, Step 4. Verify it appears after creation.

- [ ] Set `ADMIN_API_TOKEN` on Vercel
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables
  **Value:** **The exact same value** as the `ADMIN_API_TOKEN` GitHub secret on `kimlimjustin/xplorer` repo. This is how the marketplace API validates that incoming publish requests from CI are legitimate.
  **Critical:** If you change this value in one place, you must change it in both:
  1. `github.com/kimlimjustin/xplorer` > Settings > Secrets and variables > Actions > `ADMIN_API_TOKEN`
  2. `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables > `ADMIN_API_TOKEN`

- [ ] Leave `STRIPE_SECRET_KEY` empty on Vercel (or do not create it yet)
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables
  **Value:** Leave blank or skip entirely. Stripe is NOT NEEDED YET.

- [ ] Leave `STRIPE_PUBLISHABLE_KEY` empty on Vercel (or do not create it yet)
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables
  **Value:** Leave blank or skip entirely. Stripe is NOT NEEDED YET.

- [ ] Leave `STRIPE_WEBHOOK_SECRET` empty on Vercel (or do not create it yet)
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables
  **Value:** Leave blank or skip entirely. Stripe is NOT NEEDED YET.

---

### 1.2 External Service Accounts

#### Vercel

- [ ] Create a Vercel account (if you do not have one)
  **Where:** `vercel.com/signup`

- [ ] Connect the Xplorer GitHub repository to Vercel for auto-deploys
  **Where:** `vercel.com/new` > Import Git Repository > select `kimlimjustin/xplorer`
  The `apps/web/` directory contains the Next.js app with a `vercel.json` already configured.

#### Neon PostgreSQL

- [ ] Create a Neon account (free tier is sufficient to start)
  **Where:** `neon.tech` > Sign Up

- [ ] Create a new project named `xplorer-web`
  **Where:** `console.neon.tech` > click **New Project**
  Choose the region closest to your users.

- [ ] Copy the connection string
  **Where:** `console.neon.tech` > your project (`xplorer-web`) > Dashboard > Connection Details
  It will look like: `postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`

- [ ] Save this as your `DATABASE_URL` for Vercel environment variables
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables
  **Name:** `DATABASE_URL`
  **Value:** The connection string you just copied.

#### Stripe — NOT NEEDED YET

> **Extension payments via Stripe are an ongoing/future feature.** For now, all extensions are free. If extension authors want to monetize, direct them to [GitHub Sponsors](https://github.com/sponsors). Stripe integration can be added later when the marketplace has enough traffic to justify it.
>
> Leave `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET` empty (or unset) in Vercel env vars. The marketplace will work fine without them -- payment-related pages will be hidden.

#### GitHub OAuth App

- [ ] Navigate to your GitHub developer settings
  **Where:** `github.com/settings/developers` (must be logged in as `kimlimjustin` or the account that owns the project)

- [ ] Click **New OAuth App**
  **Where:** `github.com/settings/developers` > OAuth Apps tab > **New OAuth App** button

- [ ] Fill in the OAuth App registration form
  **Where:** The "Register a new OAuth application" form on GitHub
  - **Application name:** `Xplorer`
  - **Homepage URL:** `https://your-domain.vercel.app` (placeholder -- update after deploy in Phase 4)
  - **Authorization callback URL:** `https://your-domain.vercel.app/api/auth/callback/github`

- [ ] Click **Register application**
  **Where:** Bottom of the OAuth App registration form on GitHub

- [ ] Copy the **Client ID** displayed on the app page
  **Where:** `github.com/settings/developers` > OAuth Apps > click `Xplorer` > the Client ID is shown at the top
  Save this -- you will paste it into Vercel as `GITHUB_CLIENT_ID`.

- [ ] Generate and copy a **Client Secret**
  **Where:** Same page as above > click **Generate a new client secret**
  Copy the secret immediately (it will not be shown again). Save this -- you will paste it into Vercel as `GITHUB_CLIENT_SECRET`.

- [ ] You will update the callback URL once you have your actual Vercel domain (see Phase 4.3)
  **Where:** `github.com/settings/developers` > OAuth Apps > click `Xplorer` > edit the URLs

#### GitHub Personal Access Token (Sponsor Checks)

- [ ] Navigate to GitHub token settings
  **Where:** `github.com/settings/tokens`

- [ ] Click **Generate new token (classic)**
  **Where:** `github.com/settings/tokens` > **Generate new token** dropdown > **Generate new token (classic)**
  - Name: `xplorer-sponsor-check`
  - Expiration: pick a reasonable duration and set a calendar reminder to rotate
  - Scopes: check **`read:org`** (this is the only scope needed)

- [ ] Click **Generate token** and copy the value
  **Where:** Bottom of the token creation form on GitHub
  Copy the token immediately (it will not be shown again). This becomes your `GITHUB_PAT` env var on Vercel.

- [ ] Paste the token as `GITHUB_PAT` on Vercel
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables
  **Name:** `GITHUB_PAT`
  **Value:** The classic PAT you just copied.
  **Note:** This token must belong to the account that receives sponsorships (the account users sponsor).

---

## Phase 2: First Deploy (Marketplace Website)

### Step 1 -- Set up Neon database

- [ ] Log in to Neon
  **Where:** `console.neon.tech` (sign in with the account you created in Phase 1.2)

- [ ] Create project `xplorer-web`
  **Where:** `console.neon.tech` > **New Project** button
  Choose the region closest to your users (e.g. `us-east-2` for US East).

- [ ] Copy the connection string (include `?sslmode=require`)
  **Where:** `console.neon.tech` > your project (`xplorer-web`) > Dashboard > Connection Details > copy the connection string
  It looks like: `postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`

- [ ] Keep this value ready for Step 3 (you will paste it as `DATABASE_URL` on Vercel)

### Step 2 -- Configure Vercel project

- [ ] Start a new Vercel project
  **Where:** `vercel.com/new`

- [ ] Import the repository
  **Where:** `vercel.com/new` > **Import Git Repository** > search for `kimlimjustin/xplorer` > click **Import**
  Vercel will auto-detect Next.js from the `vercel.json`.

- [ ] Set the **Root Directory** to `apps/web`
  **Where:** `vercel.com/new` > after importing > in the **Configure Project** step > click **Root Directory** > type `apps/web`
  This tells Vercel where the Next.js app lives relative to the repo root.

- [ ] Verify the **Framework Preset** is **Next.js**
  **Where:** Same **Configure Project** step on Vercel
  Should be auto-detected. If not, select **Next.js** from the dropdown.

### Step 3 -- Set all environment variables on Vercel

- [ ] Open the Environment Variables page for your project
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables

- [ ] Add `DATABASE_URL`
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables > **Add New**
  **Name:** `DATABASE_URL`
  **Value:** Neon connection string from Step 1
  **Environments:** Production, Preview, Development (check all three)

- [ ] Add `NEXTAUTH_SECRET`
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables > **Add New**
  **Name:** `NEXTAUTH_SECRET`
  **Value:** Generate by running `openssl rand -base64 32` in your local terminal, then paste the output
  **Environments:** Production, Preview, Development

- [ ] Add `NEXTAUTH_URL`
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables > **Add New**
  **Name:** `NEXTAUTH_URL`
  **Value:** `https://your-project.vercel.app` (your actual Vercel URL)
  **Environments:** Production, Preview, Development

- [ ] Add `GITHUB_CLIENT_ID`
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables > **Add New**
  **Name:** `GITHUB_CLIENT_ID`
  **Value:** From Phase 1.2 GitHub OAuth App
  **Environments:** Production, Preview, Development

- [ ] Add `GITHUB_CLIENT_SECRET`
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables > **Add New**
  **Name:** `GITHUB_CLIENT_SECRET`
  **Value:** From Phase 1.2 GitHub OAuth App
  **Environments:** Production, Preview, Development

- [ ] Add `GITHUB_PAT`
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables > **Add New**
  **Name:** `GITHUB_PAT`
  **Value:** From Phase 1.2 PAT for sponsor checks
  **Environments:** Production, Preview, Development

- [ ] Add `NEXT_PUBLIC_APP_URL`
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables > **Add New**
  **Name:** `NEXT_PUBLIC_APP_URL`
  **Value:** `https://your-project.vercel.app` (same as `NEXTAUTH_URL`)
  **Environments:** Production, Preview, Development

- [ ] Add `ADMIN_API_TOKEN`
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables > **Add New**
  **Name:** `ADMIN_API_TOKEN`
  **Value:** **The exact same value** as the `ADMIN_API_TOKEN` you set as a GitHub Actions secret on `github.com/kimlimjustin/xplorer` > Settings > Secrets and variables > Actions.
  **Environments:** Production, Preview, Development
  **Why both places?** GitHub Actions uses it to authenticate when calling the marketplace publish API. The Vercel app uses it to validate those incoming requests.

- [ ] Skip Stripe variables for now (NOT NEEDED YET)
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables
  Do not add `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, or `STRIPE_WEBHOOK_SECRET`. They are not needed. The marketplace works without them.

- [ ] `BLOB_READ_WRITE_TOKEN` will be auto-added in Step 4 below -- do not create it manually

- [ ] Click **Deploy** (or trigger a redeploy if the project already exists)
  **Where:** `vercel.com` > your project (`xplorer-web`) > Deployments > **Redeploy** (or push a commit to trigger)

### Step 4 -- Create Vercel Blob store

- [ ] Navigate to the Storage tab
  **Where:** `vercel.com` > your project (`xplorer-web`) > **Storage** tab

- [ ] Create a new Blob store
  **Where:** `vercel.com` > your project (`xplorer-web`) > Storage tab > **Create Database** > select **Blob**
  **Name:** `xplorer-extensions`

- [ ] Verify `BLOB_READ_WRITE_TOKEN` was auto-added to your Vercel project
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables
  Look for `BLOB_READ_WRITE_TOKEN` in the list. It should have been auto-populated by the Blob store creation.

- [ ] Copy the `BLOB_READ_WRITE_TOKEN` value and set it as a GitHub Actions secret
  **Where (copy from):** `vercel.com` > your project (`xplorer-web`) > Storage tab > click your Blob store (`xplorer-extensions`) > look for the token value (or copy from Environment Variables)
  **Where (paste to):** `github.com/kimlimjustin/xplorer` > Settings > Secrets and variables > Actions > New repository secret
  **Name:** `BLOB_READ_WRITE_TOKEN`
  **Value:** The token you just copied from Vercel.

### Step 5 -- Run Prisma migration

- [ ] Open your local terminal and navigate to the web project directory
  **Where:** Your local terminal
  ```bash
  cd apps/web
  ```

- [ ] Set the `DATABASE_URL` environment variable locally
  **Where:** Your local terminal
  ```bash
  export DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
  ```
  Replace with the actual Neon connection string from Phase 2, Step 1.

- [ ] Push the database schema to Neon
  **Where:** Your local terminal (still in `apps/web/`)
  ```bash
  # Option A: Push schema directly (no migration history -- fine for first deploy)
  pnpm db:push

  # Option B: Create a proper migration (recommended for production)
  pnpm db:migrate
  ```

- [ ] Verify schema pushed successfully (no errors in terminal output)
  **Where:** Your local terminal -- check the command output for success messages

### Step 6 -- Seed initial data

- [ ] Run the seed script
  **Where:** Your local terminal (still in `apps/web/` with `DATABASE_URL` exported)
  ```bash
  pnpm db:seed
  ```
  This seeds categories and any initial data the marketplace needs.

- [ ] Verify seed completed successfully (no errors in terminal output)
  **Where:** Your local terminal -- check the command output for success messages

### Step 7 -- Make yourself admin

- [ ] Sign in to the deployed site via GitHub OAuth
  **Where:** Your browser > navigate to your deployed Vercel URL (e.g. `https://your-project.vercel.app`) > click **Sign in**
  This creates your user record in the Neon database.

- [ ] Promote yourself to admin
  **Where:** Your local terminal (still in `apps/web/` with `DATABASE_URL` exported)
  ```bash
  # Option A: Prisma Studio (visual web UI)
  pnpm db:studio
  # This opens a browser tab. Find your user in the User table, change `role` to `ADMIN`, save.

  # Option B: Direct SQL
  psql "$DATABASE_URL" -c "UPDATE users SET role = 'ADMIN' WHERE email = 'your@email.com';"
  ```

- [ ] Verify your account now has ADMIN role
  **Where:** Your browser > navigate to `https://your-project.vercel.app/admin`
  You should see the admin dashboard. If you get a 403 or redirect, the role update did not take effect.

### Step 8 -- Set up Stripe webhook (NOT NEEDED YET -- skip this step)

> This step is only needed if/when you enable paid extensions. For now, skip it entirely.

- [ ] Go to Stripe webhooks
  **Where:** `dashboard.stripe.com/webhooks` (log in to your Stripe account first)

- [ ] Click **Add endpoint**
  **Where:** `dashboard.stripe.com/webhooks` > **Add endpoint** button

- [ ] Set the endpoint URL
  **Where:** The "Add endpoint" form on Stripe
  **Endpoint URL:** `https://your-project.vercel.app/api/webhooks/stripe`

- [ ] Select events to listen for
  **Where:** Same form > **Select events** section
  Check these events:
  - `checkout.session.completed`
  - `account.updated` (for Connect onboarding)

- [ ] Click **Add endpoint** to save
  **Where:** Bottom of the Stripe webhook creation form

- [ ] Copy the **Signing secret** (starts with `whsec_`)
  **Where:** `dashboard.stripe.com/webhooks` > click your new endpoint > **Signing secret** section > click to reveal and copy

- [ ] Add the signing secret to Vercel as `STRIPE_WEBHOOK_SECRET`
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables > **Add New**
  **Name:** `STRIPE_WEBHOOK_SECRET`
  **Value:** The `whsec_...` string you just copied from Stripe

- [ ] Redeploy after adding the new env var
  **Where:** `vercel.com` > your project (`xplorer-web`) > Deployments > pick latest > **Redeploy**
  Or from your local terminal: `npx vercel --prod`

### Step 9 -- Update GitHub OAuth callback URL

- [ ] Navigate to your GitHub OAuth App settings
  **Where:** `github.com/settings/developers` > OAuth Apps tab > click `Xplorer`

- [ ] Update **Homepage URL** to your actual Vercel URL
  **Where:** The OAuth App edit form on GitHub
  **Value:** `https://your-project.vercel.app` (or your custom domain if you have set one up in Phase 4)

- [ ] Update **Authorization callback URL**
  **Where:** Same form
  **Value:** `https://your-project.vercel.app/api/auth/callback/github`

- [ ] Click **Update application** to save
  **Where:** Bottom of the OAuth App edit form on GitHub

### Step 10 -- Verify deployment

- [ ] Visit the deployed URL -- landing page loads
  **Where:** Your browser > navigate to `https://your-project.vercel.app`

- [ ] Click **Sign in** -- GitHub OAuth flow works
  **Where:** Your browser > the deployed site > click the Sign in button

- [ ] Check `/admin` route -- accessible with your admin account
  **Where:** Your browser > navigate to `https://your-project.vercel.app/admin`

- [ ] Upload a test extension (if submit endpoint is ready) or verify API responds
  **Where:** Your browser > navigate to `https://your-project.vercel.app/api/extensions` -- should return JSON

- [ ] Check Prisma Studio -- categories are seeded, your user exists
  **Where:** Your local terminal (in `apps/web/` with `DATABASE_URL` exported)
  ```bash
  pnpm db:studio
  ```
  Verify in the browser tab that opens: User table has your record with `ADMIN` role, Category table has seeded entries.

---

## Phase 3: Code Signing (Desktop App) — OPTIONAL

> **You can skip this entire phase.** The app works fine without code signing -- users just click through an OS warning dialog ("unidentified developer" on macOS, SmartScreen on Windows). Many open-source apps ship unsigned. Only add signing later if users complain or you want App Store distribution.

The release workflow already builds and uploads to GitHub Releases on `v*` tag push without any signing. The instructions below are for when/if you decide to add it.

### 3.1 macOS Code Signing & Notarization

**Prerequisites:**

- [ ] Enroll in the Apple Developer Program ($99/year)
  **Where:** `developer.apple.com/programs/` > click **Enroll**
  You need an Apple ID. Enrollment can take up to 48 hours to be approved.

**Create Developer ID Application certificate:**

- [ ] Open **Keychain Access** on your Mac
  **Where:** Your Mac > Applications > Utilities > Keychain Access (or Spotlight search "Keychain Access")

- [ ] Request a certificate from a Certificate Authority
  **Where:** Keychain Access app > menu bar > **Keychain Access** > **Certificate Assistant** > **Request a Certificate from a Certificate Authority**
  Fill in your email and name, select **Saved to disk**, click **Continue**, and save the `.certSigningRequest` file.

- [ ] Create a Developer ID Application certificate on Apple's portal
  **Where:** `developer.apple.com/account/resources/certificates/add`
  1. Select **Developer ID Application** as the certificate type
  2. Click **Continue**
  3. Upload the `.certSigningRequest` file you just saved
  4. Click **Continue**
  5. Download the `.cer` certificate file

- [ ] Install the certificate into your Keychain
  **Where:** Your Mac > Finder > double-click the downloaded `.cer` file
  It will automatically install into Keychain Access.

**Export the certificate for CI:**

- [ ] Export the certificate as a `.p12` file
  **Where:** Keychain Access app > **My Certificates** category (in the left sidebar) > find "Developer ID Application: Your Name" > right-click > **Export Items**
  Save as `.p12` format. Set a strong password when prompted. Remember this password.

- [ ] Base64-encode the `.p12` file
  **Where:** Your local terminal
  ```bash
  base64 -i Certificates.p12 -o certificate-base64.txt
  ```
  The contents of `certificate-base64.txt` will be your `APPLE_CERTIFICATE` secret.

**Set GitHub Secrets for macOS signing:**

- [ ] Set `APPLE_CERTIFICATE`
  **Where:** `github.com/kimlimjustin/xplorer` > Settings > Secrets and variables > Actions > New repository secret
  **Name:** `APPLE_CERTIFICATE`
  **Value:** The full contents of `certificate-base64.txt` (the base64-encoded `.p12`)

- [ ] Set `APPLE_CERTIFICATE_PASSWORD`
  **Where:** `github.com/kimlimjustin/xplorer` > Settings > Secrets and variables > Actions > New repository secret
  **Name:** `APPLE_CERTIFICATE_PASSWORD`
  **Value:** The password you set when exporting the `.p12` file from Keychain Access

- [ ] Set `APPLE_SIGNING_IDENTITY`
  **Where:** `github.com/kimlimjustin/xplorer` > Settings > Secrets and variables > Actions > New repository secret
  **Name:** `APPLE_SIGNING_IDENTITY`
  **Value:** The full name of the certificate as shown in Keychain Access, e.g. `Developer ID Application: Your Name (TEAM_ID)`
  **How to find it:** Open Keychain Access > My Certificates > the certificate name is shown in the list

- [ ] Set `APPLE_ID`
  **Where:** `github.com/kimlimjustin/xplorer` > Settings > Secrets and variables > Actions > New repository secret
  **Name:** `APPLE_ID`
  **Value:** Your Apple ID email address (the one you used to enroll in the Apple Developer Program)

- [ ] Generate an app-specific password for notarization
  **Where:** `appleid.apple.com/account/manage` > Sign in > **Sign-In and Security** > **App-Specific Passwords** > click the **+** button
  **Label:** `xplorer-notarization`
  Copy the generated password immediately.

- [ ] Set `APPLE_PASSWORD`
  **Where:** `github.com/kimlimjustin/xplorer` > Settings > Secrets and variables > Actions > New repository secret
  **Name:** `APPLE_PASSWORD`
  **Value:** The app-specific password you just generated from `appleid.apple.com`

- [ ] Set `APPLE_TEAM_ID`
  **Where:** `github.com/kimlimjustin/xplorer` > Settings > Secrets and variables > Actions > New repository secret
  **Name:** `APPLE_TEAM_ID`
  **Value:** Your 10-character Apple Developer Team ID
  **How to find it:** `developer.apple.com/account` > **Membership Details** (in the left sidebar or under your account) > Team ID

**Update the release workflow:**

The `tauri-apps/tauri-action` supports code signing via these environment variables. You need to add them to the macOS build steps in `.github/workflows/release.yml`. The Tauri action will automatically handle signing and notarization when these env vars are present.

### 3.2 Windows Code Signing (Authenticode)

**Get a code signing certificate:**

- [ ] Purchase an Authenticode code signing certificate from a trusted CA
  **Where:** One of these Certificate Authority websites:
  - **DigiCert:** `digicert.com/signing/code-signing-certificates` (recommended, ~$474/year)
  - **Sectigo:** `sectigo.com/ssl-certificates-tls/code-signing` (~$200/year for OV)
  - **SSL.com:** `ssl.com/certificates/code-signing/` (~$200/year for OV)
  **Note:** EV certificates provide immediate SmartScreen reputation but require hardware tokens (USB). OV certificates build reputation over time through downloads.

**Export the certificate for CI:**

- [ ] Base64-encode the certificate file
  **Where:** Your local terminal
  You will receive a `.pfx` or `.p12` file from your CA.
  ```bash
  base64 -i certificate.pfx -o win-certificate-base64.txt
  ```

**Set GitHub Secrets for Windows signing:**

- [ ] Set `WINDOWS_CERTIFICATE`
  **Where:** `github.com/kimlimjustin/xplorer` > Settings > Secrets and variables > Actions > New repository secret
  **Name:** `WINDOWS_CERTIFICATE`
  **Value:** The full contents of `win-certificate-base64.txt` (the base64-encoded `.pfx`)

- [ ] Set `WINDOWS_CERTIFICATE_PASSWORD`
  **Where:** `github.com/kimlimjustin/xplorer` > Settings > Secrets and variables > Actions > New repository secret
  **Name:** `WINDOWS_CERTIFICATE_PASSWORD`
  **Value:** The password for the `.pfx` file (set by the CA or by you during export)

**Update the release workflow:**

The `tauri-apps/tauri-action` supports Windows signing when these env vars are set on the Windows build step. Tauri will use SignTool automatically.

### 3.3 Linux

Linux builds (.deb, .AppImage) do not require code signing for distribution. Optional: GPG-sign your `.deb` packages if you plan to host an APT repository.

---

## Phase 4: DNS & Domain

### 4.1 Register/configure your domain

- [ ] Register a domain (e.g., `xplorer.app`) if you do not already have one
  **Where:** A domain registrar of your choice:
  - **Cloudflare Registrar:** `dash.cloudflare.com` > Registrar
  - **Namecheap:** `namecheap.com`
  - **Google Domains:** `domains.google`

### 4.2 Connect domain to Vercel

- [ ] Add your domain to the Vercel project
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > **Domains** > click **Add**
  Enter your domain (e.g. `xplorer.app`).

- [ ] Note the DNS records Vercel displays
  **Where:** Same page -- Vercel will show you which DNS records to configure:
  - For apex domain (`xplorer.app`): Add an `A` record pointing to `76.76.21.21`
  - For `www` subdomain: Add a `CNAME` record pointing to `cname.vercel-dns.com`

- [ ] Add DNS records at your domain registrar
  **Where:** Your domain registrar's DNS management page (e.g. `dash.cloudflare.com` > your domain > DNS, or `namecheap.com` > Domain List > your domain > Advanced DNS)
  Add the records Vercel specified above.

- [ ] Wait for DNS propagation (usually 5-60 minutes, up to 48 hours)
  **Where:** You can check propagation status at `dnschecker.org`

- [ ] Verify Vercel auto-provisioned an SSL certificate
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Domains
  Your domain should show a green checkmark and "Valid Configuration". Vercel uses Let's Encrypt for free SSL.

### 4.3 Update all references after domain change

After your custom domain is live, update these:

- [ ] Update `NEXTAUTH_URL` on Vercel
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables > find `NEXTAUTH_URL` > click edit
  **New value:** `https://xplorer.app` (your custom domain)

- [ ] Update `NEXT_PUBLIC_APP_URL` on Vercel
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables > find `NEXT_PUBLIC_APP_URL` > click edit
  **New value:** `https://xplorer.app` (your custom domain)

- [ ] Update `MARKETPLACE_URL` in GitHub Actions secrets
  **Where:** `github.com/kimlimjustin/xplorer` > Settings > Secrets and variables > Actions > find `MARKETPLACE_URL` > click the pencil icon to update
  **New value:** `https://xplorer.app` (your custom domain)

- [ ] Update GitHub OAuth App URLs
  **Where:** `github.com/settings/developers` > OAuth Apps > click `Xplorer`
  - **Homepage URL** > change to `https://xplorer.app`
  - **Authorization callback URL** > change to `https://xplorer.app/api/auth/callback/github`
  Click **Update application** to save.

- [ ] Update Stripe webhook endpoint URL (only if Stripe is configured)
  **Where:** `dashboard.stripe.com/webhooks` > click your endpoint > **Edit** > change URL to `https://xplorer.app/api/webhooks/stripe`

- [ ] Redeploy after env var changes
  **Where:** `vercel.com` > your project (`xplorer-web`) > Deployments > pick latest > **Redeploy**
  Or push a commit, or run `npx vercel --prod` from your local terminal.

---

## Phase 5: Monitoring & Observability

### 5.1 Error Tracking (Sentry)

- [ ] Create a Sentry account
  **Where:** `sentry.io/signup/`

- [ ] Create a new Sentry project for the marketplace website
  **Where:** `sentry.io` > your organization > **Projects** > **Create Project** > select **Next.js** as the platform

- [ ] Install the Sentry SDK into the web project
  **Where:** Your local terminal (in the `apps/web/` directory)
  ```bash
  cd apps/web
  npx @sentry/wizard@latest -i nextjs
  ```
  Follow the wizard prompts. It will create/modify configuration files and output a `SENTRY_DSN`.

- [ ] Add the `SENTRY_DSN` environment variable to Vercel
  **Where:** `vercel.com` > your project (`xplorer-web`) > Settings > Environment Variables > **Add New**
  **Name:** `SENTRY_DSN`
  **Value:** The DSN string from the Sentry wizard output (looks like `https://xxx@xxx.ingest.sentry.io/xxx`)

- [ ] (Optional) Set up a second Sentry project for the Tauri desktop app
  **Where:** `sentry.io` > your organization > **Projects** > **Create Project** > select **Rust** (for backend) or **React** (for frontend) as the platform

### 5.2 Vercel Analytics

- [ ] Enable Vercel Analytics
  **Where:** `vercel.com` > your project (`xplorer-web`) > **Analytics** tab > click **Enable**
  Available on Hobby plan and above. Web Vitals and traffic analytics will start collecting automatically.

- [ ] (Optional) Enable Speed Insights for per-page performance data
  **Where:** `vercel.com` > your project (`xplorer-web`) > **Speed Insights** tab > click **Enable**

### 5.3 Uptime Monitoring

- [ ] Create an account on an uptime monitoring service
  **Where:** One of these free-tier services:
  - **Better Uptime:** `betteruptime.com` (free tier: 5 monitors, 3-min checks)
  - **UptimeRobot:** `uptimerobot.com` (free tier: 50 monitors, 5-min checks)
  - **Checkly:** `checklyhq.com` (free tier: 5 checks)

- [ ] Add a monitor for the marketing site
  **Where:** Your chosen uptime monitoring service's dashboard > **Add Monitor** / **New Check**
  **URL:** `https://your-domain/` (your Vercel URL or custom domain)
  **Expected status:** 200

- [ ] Add a monitor for the API
  **Where:** Same dashboard > **Add Monitor** / **New Check**
  **URL:** `https://your-domain/api/extensions`
  **Expected status:** 200

- [ ] Configure alert notifications
  **Where:** Your chosen uptime monitoring service's dashboard > **Settings** / **Alerting** / **Integrations**
  Set up alerts via email, Slack, Discord, or your preferred channel.

### 5.4 Database Monitoring

- [ ] Review built-in Neon monitoring
  **Where:** `console.neon.tech` > your project (`xplorer-web`) > **Monitoring** tab
  Neon provides:
  - Connection count
  - Query performance
  - Storage usage

- [ ] Set up Neon email alerts for approaching plan limits
  **Where:** `console.neon.tech` > your project (`xplorer-web`) > **Settings** > look for notification/alert preferences

- [ ] Review the Monitoring tab periodically after launch
  **Where:** `console.neon.tech` > your project (`xplorer-web`) > **Monitoring** tab

### 5.5 Stripe Monitoring (NOT NEEDED YET -- only if using paid extensions)

- [ ] Enable Stripe Radar for fraud detection (auto-enabled on live mode)
  **Where:** `dashboard.stripe.com` > **Radar** section (visible in left sidebar)

- [ ] Set up Stripe email alerts
  **Where:** `dashboard.stripe.com/settings/emails`
  Enable alerts for:
  - Failed payments
  - Disputes/chargebacks
  - Payout failures

---

## Quick Reference: All Secrets & Environment Variables

### GitHub Repository Secrets (`github.com/kimlimjustin/xplorer` > Settings > Secrets > Actions)

| Secret | Purpose | Generated How |
|--------|---------|---------------|
| `EXTENSION_SIGNING_KEY` | Ed25519 private key for extension signing | `cargo test generate_signing_keypair -- --ignored --nocapture` in `apps/src-tauri/` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob upload from CI | Copied from Vercel Blob store setup (Phase 2, Step 4) |
| `MARKETPLACE_URL` | Production URL for publish callback | Your Vercel or custom domain URL |
| `ADMIN_API_TOKEN` | Auth token for publish endpoint | `openssl rand -hex 32` in your local terminal. **Must match Vercel env var.** |
| `APPLE_CERTIFICATE` | Base64-encoded macOS signing cert | Export from Keychain Access, then base64-encode (OPTIONAL -- Phase 3) |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the .p12 cert | Set during Keychain Access export (OPTIONAL -- Phase 3) |
| `APPLE_SIGNING_IDENTITY` | Certificate name | From Keychain Access, e.g. `Developer ID Application: ...` (OPTIONAL -- Phase 3) |
| `APPLE_ID` | Apple ID email | Your Apple Developer email (OPTIONAL -- Phase 3) |
| `APPLE_PASSWORD` | App-specific password | `appleid.apple.com/account/manage` > App-Specific Passwords (OPTIONAL -- Phase 3) |
| `APPLE_TEAM_ID` | 10-char team ID | `developer.apple.com/account` > Membership Details (OPTIONAL -- Phase 3) |
| `WINDOWS_CERTIFICATE` | Base64-encoded Windows signing cert | From your CA (DigiCert, Sectigo, etc.), then base64-encode (OPTIONAL -- Phase 3) |
| `WINDOWS_CERTIFICATE_PASSWORD` | Password for the .pfx cert | Set by the CA or during export (OPTIONAL -- Phase 3) |

### Vercel Environment Variables (`vercel.com` > your project > Settings > Environment Variables)

| Variable | Purpose | Source |
|----------|---------|--------|
| `DATABASE_URL` | Neon PostgreSQL connection string | `console.neon.tech` > your project > Dashboard |
| `NEXTAUTH_SECRET` | Session encryption secret | `openssl rand -base64 32` in your local terminal |
| `NEXTAUTH_URL` | Public app URL | Your Vercel URL or custom domain |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | `github.com/settings/developers` > your OAuth App |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | `github.com/settings/developers` > your OAuth App |
| `GITHUB_PAT` | PAT for sponsor status checks | `github.com/settings/tokens` (classic, `read:org` scope) |
| `NEXT_PUBLIC_APP_URL` | Public app URL (client-side) | Same as `NEXTAUTH_URL` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob store access | Auto-added by Vercel when creating Blob store |
| `ADMIN_API_TOKEN` | Validates CI publish calls | **Same value as the GitHub Secret.** `openssl rand -hex 32` in your local terminal |
| `SENTRY_DSN` | Sentry error tracking | `sentry.io` > your project > Settings > Client Keys (DSN) |
| `STRIPE_SECRET_KEY` | Stripe API secret (NOT NEEDED YET) | `dashboard.stripe.com/apikeys` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (NOT NEEDED YET) | `dashboard.stripe.com/apikeys` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (NOT NEEDED YET) | `dashboard.stripe.com/webhooks` > your endpoint |

---

## Post-Deploy Verification Checklist

Run through this after completing all phases:

- [ ] Marketplace website loads at your domain
  **Where:** Your browser > navigate to your deployed URL

- [ ] GitHub OAuth sign-in works end to end
  **Where:** Your browser > deployed site > click Sign in > complete GitHub OAuth flow

- [ ] Admin dashboard accessible at `/admin`
  **Where:** Your browser > `https://your-domain/admin`

- [ ] Categories are seeded (visible in marketplace browse)
  **Where:** Your browser > `https://your-domain` > browse the marketplace > verify categories appear

- [ ] Extension upload and download works (Vercel Blob)
  **Where:** Your browser > deployed site > submit a test extension (or test the API directly)

- [ ] `sign-extension.yml` workflow runs when triggered via `repository_dispatch`
  **Where:** `github.com/kimlimjustin/xplorer` > Actions tab > look for `sign-extension` workflow runs

- [ ] Signed extensions pass verification in the desktop app (`signing.rs`)
  **Where:** Your local development environment > install a signed extension in the desktop app and verify no signature errors

- [ ] Desktop release builds for all 3 platforms (push a `v*` tag to test)
  **Where:** `github.com/kimlimjustin/xplorer` > Actions tab > push a tag like `v0.0.1-test` and watch the release workflow

- [ ] macOS build is signed and notarized (no Gatekeeper warning) -- OPTIONAL, only if Phase 3 completed
  **Where:** A macOS machine > download the built `.dmg` from GitHub Releases > open it > verify no "unidentified developer" warning

- [ ] Windows build is signed (no SmartScreen warning) -- OPTIONAL, only if Phase 3 completed
  **Where:** A Windows machine > download the built `.exe` or `.msi` from GitHub Releases > run it > verify no SmartScreen popup

- [ ] Stripe webhook receives events (only if Stripe is configured)
  **Where:** `dashboard.stripe.com/webhooks` > click your endpoint > **Logs** tab > verify events are being received

- [ ] Uptime monitor is active and sending test alerts
  **Where:** Your uptime monitoring service dashboard > verify monitors show "Up" status and test an alert

- [ ] Sentry receives test errors (throw a test error, confirm it appears)
  **Where:** `sentry.io` > your project > **Issues** tab > verify a test error appears

---

## Important Security Notes

1. **Rotate the Ed25519 signing key:** The current private key is visible in the `signing.rs` source code (in a comment and in test constants). After setting it as a GitHub Secret, remove all traces from source code. If you consider it compromised, generate a new key pair and update `OFFICIAL_PUBLIC_KEY` in `signing.rs`.
   **Where to update the public key:** `apps/src-tauri/src/extensions/` > find `OFFICIAL_PUBLIC_KEY` in the signing module
   **Where to update the private key secret:** `github.com/kimlimjustin/xplorer` > Settings > Secrets and variables > Actions > `EXTENSION_SIGNING_KEY`

2. **Never commit secrets:** Do not add `.env` files, certificates, or private keys to version control. The `.gitignore` should already exclude `.env*` files.
   **Where to verify:** Check `apps/src-tauri/.gitignore` and the root `.gitignore` for `.env*` entries

3. **Use Stripe test mode first:** Set up everything with `sk_test_` / `pk_test_` keys. Switch to live keys (`sk_live_` / `pk_live_`) only after end-to-end testing is complete.
   **Where to find test vs live keys:** `dashboard.stripe.com/apikeys` > toggle between "Test mode" and "Live mode" using the switch in the Stripe dashboard header

4. **Certificate renewal:** Apple Developer certificates and Authenticode certificates expire (typically 1-5 years). Set calendar reminders for renewal to avoid broken release builds.
   **Where to check Apple certificate expiry:** `developer.apple.com/account/resources/certificates/list`
   **Where to check Windows certificate expiry:** Your CA's dashboard (DigiCert, Sectigo, SSL.com, etc.)
