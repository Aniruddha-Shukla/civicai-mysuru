# Deploying CivicAI to Vercel

About 15 minutes, using free Supabase and Vercel accounts. Migrations and demo data run automatically during the Vercel build, so nothing needs running by hand afterwards.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com), create a project, and **save the database password**.
2. Choose the **Mumbai (ap-south-1)** region. `vercel.json` runs the app in Mumbai (`bom1`), so the two sit next to each other. If you pick another region, change `regions` in `vercel.json` to match, or every page will be slow.

## 2. Turn off email confirmation

In Supabase, go to **Authentication → Sign In / Providers → Email** and turn off **Confirm email**.

Otherwise anyone signing up during your demo has to confirm by email, and Supabase's built-in mail service is heavily limited. The demo accounts aren't affected.

## 3. Fill in your settings and check them

Create your settings file. It's git-ignored, so it will never be committed:

```bash
cp .env.example .env.vercel
```

Fill it in:

| Setting | Where to find it |
|---|---|
| `DATABASE_URL` | **Connect** button → **Transaction pooler** (port 6543). Add `?pgbouncer=true&connection_limit=1` to the end |
| `DIRECT_URL` | **Connect** button → **Session pooler** (port 5432). **Not** "Direct connection": that host is IPv6-only and Vercel can't reach it |
| `NEXT_PUBLIC_SUPABASE_URL` | **Project Settings → API**: Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Project Settings → API Keys**: publishable key (or legacy anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Project Settings → API Keys**: secret key (or legacy service_role key) |
| `CRON_SECRET` | Generate one with `openssl rand -hex 32` |
| `DEMO_OPERATOR_PASSWORD`, `DEMO_CITIZEN_PASSWORD` | Choose your own. The defaults are written in the README, so don't use them on a public site |
| `GEMINI_API_KEY` | Optional. Free from [Google AI Studio](https://aistudio.google.com/apikey) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Optional. Without it, onboarding shows a ward list instead of a map |

Replace the database password in both URLs. If it contains special characters such as `@` or `#`, percent-encode them.

Then test everything against your real project. This only reads, and it never prints a secret:

```bash
npm run check:deploy
```

Continue when it says **READY**.

## 4. Deploy on Vercel

1. At [vercel.com/new](https://vercel.com/new), import the `civicai-mysuru` GitHub repository. Leave the build settings alone: `vercel.json` already sets them.
2. Open **Environment Variables** and paste the whole contents of `.env.vercel` into the first field. Vercel splits it into separate variables.
3. Click **Deploy**.

## 5. Finish up

1. In Supabase, go to **Authentication → URL Configuration** and set **Site URL** to your Vercel URL.
2. Open `https://YOUR-APP.vercel.app/api/health`. You should see `"database":true`, `"auth":true`, `"storage":true` and `"cron":true`.
3. Sign in with the demo accounts and run through the [evaluator tour](README.md#2-minute-evaluator-tour).

## Optional: keep the sync every 6 hours

Vercel's free Hobby plan allows cron **once a day**, and rejects anything more frequent, so `vercel.json` runs the sync daily at about 6 AM IST. This doesn't delay alerts: verifying or withdrawing a notice notifies citizens immediately, and the daily run is the safety net.

To keep the paper's 6-hour schedule for free, use the included GitHub workflow. In the GitHub repo, go to **Settings → Secrets and variables → Actions** and add:

- Variable `APP_URL`: your Vercel URL, with no trailing slash
- Secret `CRON_SECRET`: the same value as in Vercel

## If something goes wrong

| Symptom | Cause and fix |
|---|---|
| Build fails with "Hobby accounts are limited to daily cron jobs" | `vercel.json` was changed to a more frequent schedule. Put back the daily one |
| Build fails with `P1001: Can't reach database server` | `DIRECT_URL` uses the direct host. Use the Session pooler string |
| Build fails with `P1000: Authentication failed` | Wrong database password, or special characters not percent-encoded |
| Build log says "Demo seed failed" | The app still deployed, but demo accounts may be missing. Check `SUPABASE_SERVICE_ROLE_KEY`, then redeploy |
| Sign-in page says sign-in isn't configured | A `NEXT_PUBLIC_*` value was missing at build time. Add it and **redeploy**: these are built in, so changing them needs a new build |
| Pages are slow | Vercel and Supabase are in different regions (see step 1) |
| AI features show "temporarily unavailable" | `GEMINI_API_KEY` is empty or its free quota is used up. Everything else keeps working |
