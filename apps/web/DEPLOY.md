# Deploying Xplorer Web

The Xplorer website (docs + marketplace + billing) is a Next.js 15 app deployed to **Vercel** with **Neon PostgreSQL** and **Vercel Blob** storage.

Pro subscriptions are managed via **GitHub Sponsors** (automatic status checking). Stripe is used only for **paid extension purchases** (Stripe Connect for author payouts).

---

## Prerequisites

- [Vercel account](https://vercel.com/signup)
- [Neon account](https://neon.tech) (free tier works)
- [Stripe account](https://dashboard.stripe.com/register) (for paid extension marketplace)
- [GitHub OAuth app](https://github.com/settings/developers) (for auth)
- [GitHub Personal Access Token](https://github.com/settings/tokens) (for sponsor status checking)

---

## Step 1 — Create the Database (Neon)

1. Go to [neon.tech](https://neon.tech) and create a new project
2. Name it `xplorer-web` (or whatever you want)
3. Copy the **connection string** — it looks like:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Save this as your `DATABASE_URL`

---

## Step 2 — Create a GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: `Xplorer`
   - **Homepage URL**: `https://your-domain.vercel.app` (update later)
   - **Authorization callback URL**: `https://your-domain.vercel.app/api/auth/callback/github`
4. Click **Register application**
5. Copy the **Client ID** → `GITHUB_CLIENT_ID`
6. Generate a **Client Secret** → `GITHUB_CLIENT_SECRET`

> After deploying, come back and update the URLs with your actual Vercel domain.

---

## Step 3 — Create a GitHub Personal Access Token

This token is used to check if users are sponsoring you on GitHub (for Pro tier).

1. Go to [GitHub → Settings → Tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Name it `xplorer-sponsor-check`
4. Select the `read:org` scope (needed for sponsor queries)
5. Generate and copy the token → `GITHUB_PAT`

> The app checks sponsor status automatically on each sign-in. Users can also manually refresh from the billing page.

---

## Step 4 — Set Up Stripe (for paid extensions)

Stripe is only needed if you want to support paid extensions in the marketplace. If you only need free extensions, you can skip this step.

### 4a. API Keys
1. Go to [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys)
2. Copy **Publishable key** → `STRIPE_PUBLISHABLE_KEY`
3. Copy **Secret key** → `STRIPE_SECRET_KEY`

### 4b. Webhook (after deploy)
You'll set this up after deploying — see Step 7.

---

## Step 5 — Deploy to Vercel

### Option A: Via Vercel Dashboard (recommended)

1. Push the monorepo to GitHub:
   ```bash
   git add -A
   git commit -m "Initial deploy"
   git push
   ```

2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the `xplorer` repo
4. Set the **Root Directory** to `apps/web`
5. Vercel auto-detects Next.js — the `vercel.json` handles build config
5. Add **Environment Variables** (all required):

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | Your Neon connection string |
   | `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` to generate |
   | `NEXTAUTH_URL` | `https://your-project.vercel.app` |
   | `GITHUB_CLIENT_ID` | From Step 2 |
   | `GITHUB_CLIENT_SECRET` | From Step 2 |
   | `GITHUB_PAT` | From Step 3 |
   | `STRIPE_SECRET_KEY` | From Step 4 (optional if no paid extensions) |
   | `STRIPE_PUBLISHABLE_KEY` | From Step 4 (optional if no paid extensions) |
   | `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` |
   | `BLOB_READ_WRITE_TOKEN` | (see Step 5b) |

6. Click **Deploy**

### Option B: Via CLI

```bash
cd apps/web
npx vercel
# Follow prompts, link to project
# Then set env vars:
npx vercel env add DATABASE_URL
npx vercel env add NEXTAUTH_SECRET
# ... etc for each variable
npx vercel --prod
```

### 5b. Vercel Blob Token

1. In Vercel Dashboard → your project → **Storage** tab
2. Click **Create Database** → select **Blob**
3. Name it `xplorer-extensions`
4. The `BLOB_READ_WRITE_TOKEN` is auto-added to your project env vars

---

## Step 6 — Initialize the Database

After the first successful deploy:

```bash
cd apps/web

# Set DATABASE_URL locally (or use .env)
export DATABASE_URL="postgresql://..."

# Push the schema to Neon
pnpm db:push

# Seed categories
pnpm db:seed
```

Or if you prefer migrations:
```bash
pnpm db:migrate
pnpm db:seed
```

Verify with:
```bash
pnpm db:studio
```
This opens Prisma Studio at `localhost:5555` to browse your data.

---

## Step 7 — Set Up Stripe Webhook (optional)

Only needed if you're supporting paid extensions.

1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Set URL to: `https://your-project.vercel.app/api/webhooks/stripe`
4. Select events:
   - `checkout.session.completed`
   - `account.updated` (for Connect onboarding)
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`)
7. Add it to Vercel env vars as `STRIPE_WEBHOOK_SECRET`
8. Redeploy: `npx vercel --prod` or push a commit

---

## Step 8 — Update OAuth Callback URL

Now that you have your Vercel URL:

1. Go back to [GitHub OAuth App settings](https://github.com/settings/developers)
2. Update:
   - **Homepage URL**: `https://your-project.vercel.app`
   - **Authorization callback URL**: `https://your-project.vercel.app/api/auth/callback/github`
3. Save

---

## Step 9 — Custom Domain (Optional)

1. In Vercel Dashboard → your project → **Domains**
2. Add your domain (e.g., `xplorer.app`)
3. Update DNS records as Vercel instructs
4. Update these env vars with the new domain:
   - `NEXTAUTH_URL`
   - `NEXT_PUBLIC_APP_URL`
5. Update the GitHub OAuth callback URL
6. Update the Stripe webhook URL (if applicable)
7. Redeploy

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | Random secret for session encryption |
| `NEXTAUTH_URL` | Yes | Your app's public URL |
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth app client secret |
| `GITHUB_PAT` | Yes | GitHub PAT with `read:org` scope for sponsor checks |
| `STRIPE_SECRET_KEY` | No* | Stripe API secret key (*required for paid extensions) |
| `STRIPE_PUBLISHABLE_KEY` | No* | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | No* | Stripe webhook signing secret |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app URL |
| `BLOB_READ_WRITE_TOKEN` | Yes | Vercel Blob storage token |

---

## How Pro Tier Works

Pro access is granted automatically to GitHub Sponsors:

1. **On sign-in**: The app checks the GitHub Sponsors GraphQL API to see if the user sponsors `kimlimjustin`
2. **Manual refresh**: Users can click "Refresh Status" on the billing page (`/billing`)
3. **API endpoint**: `POST /api/sponsors/check` refreshes status on demand

If a user stops sponsoring, their tier will revert to FREE on their next sign-in.

---

## Troubleshooting

### "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set"
You missed setting the GitHub OAuth env vars. Add them in Vercel Dashboard → Settings → Environment Variables and redeploy.

### "PrismaClientInitializationError: Can't reach database server"
Your `DATABASE_URL` is wrong or Neon is sleeping. Check the connection string includes `?sslmode=require`.

### Sponsor check always returns false
Make sure `GITHUB_PAT` is set and has the `read:org` scope. The token must belong to the account being sponsored (`kimlimjustin`).

### Stripe webhook returns 500
Check that `STRIPE_WEBHOOK_SECRET` matches the signing secret from your webhook endpoint (not your API secret key).

### "Extension file upload failed"
Make sure you've created a Vercel Blob store and the `BLOB_READ_WRITE_TOKEN` is set.

### Auth callback error after deploy
Make sure the GitHub OAuth callback URL matches exactly: `https://YOUR_DOMAIN/api/auth/callback/github` (no trailing slash).

---

## Making Yourself Admin

After signing in for the first time:

```bash
# Using Prisma Studio
pnpm db:studio
# Find your user → change role to ADMIN

# Or via SQL
psql $DATABASE_URL -c "UPDATE users SET role = 'ADMIN' WHERE email = 'your@email.com';"
```

---

## Updating

Push to your repo and Vercel auto-deploys. For schema changes:

```bash
cd apps/web
# Edit prisma/schema.prisma
pnpm db:push     # Apply to Neon (no migration history)
# or
pnpm db:migrate  # Create migration (recommended for production)
```
