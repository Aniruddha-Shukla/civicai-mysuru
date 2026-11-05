# CivicAI Mysuru

**A verified citizen-communication layer for disrupted municipal waste-collection schedules.**

Mysuru City Corporation (MCC) runs a decentralised solid-waste system (8 zones, ~65 wards, 7 Zero Waste Management plants, ~452 t/day generated, ~402 t/day collected). Existing work optimises the *municipal* side: routes, plants and logistics. Nothing tells **citizens** whether, when or how collection resumes after a holiday, vehicle breakdown, road closure, weather event, special event, operational constraint or emergency decision. CivicAI fills that gap. It sits **above** existing municipal systems without replacing them, and it is preventive rather than reactive: verified ward-level alerts go out *before* the missed collection, and complaints and tracking are there for when things still go wrong (**Predict → Inform → Report → Track → Accountability**).

> **Core principle (from the paper):** AI never invents or authorizes a municipal schedule. Alternative arrangements must originate from verified municipal sources or authorized operators. When no alternative has been officially published, the system says so plainly instead of generating an unsupported schedule.

The principle is enforced by code. The checks are listed in [How the principle is enforced](#how-the-principle-is-enforced).

---

## Contents

- [2-minute evaluator tour](#2-minute-evaluator-tour)
- [Architecture](#architecture)
- [How the principle is enforced](#how-the-principle-is-enforced)
- [Tech stack](#tech-stack)
- [Environment variables](#environment-variables)
- [Local setup](#local-setup)
- [Deploying to Vercel](#deploying-to-vercel) (step-by-step in [DEPLOY.md](DEPLOY.md))
- [API reference](#api-reference)
- [Design decisions](#design-decisions)
- [Edge-case checklist → implementation](#edge-case-checklist--implementation)
- [Privacy](#privacy)
- [Testing & CI](#testing--ci)
- [Limitations](#limitations)
- [Objectives & research questions → where they are demonstrated](#objectives--research-questions--where-they-are-demonstrated)

---

## 2-minute evaluator tour

### Demo accounts

These are created by the seed script (locally and on every Vercel build):

| Role | Email | Password |
|---|---|---|
| Citizen (Ward 1 – Chamarajapuram) | `citizen@civicai.example` | `CivicAI-Citizen-2026` |
| Operator (MCC control room) | `operator@civicai.example` | `CivicAI-Operator-2026` |

You can override them with `DEMO_*` env vars, and **you should on a public deployment** (see [Environment variables](#environment-variables)). Operator accounts can never be self-registered. Sign-up always creates a `CITIZEN`, and the role is never read from user-editable Supabase metadata.

### Seeded scenarios

All dates are relative to the day the seed ran, in IST.

| | Scenario | Where to see it | What it proves |
|---|---|---|---|
| **A** | Monday municipal holiday, **verified** alternative Wednesday 7:00 AM | Citizen → Home, Alerts | Exact **Case A** text; card shows *"Alternative collection: Wednesday 7 AM."* |
| **B** | The following Monday, same disruption, **zero arrangements** | Citizen → Home, Alerts | Exact **Case B** text; card shows *"No alternative arrangement has been officially published."* plus the §5 fallback sentence |
| **C** | Thursday dry-waste breakdown: a Case B alert was sent, **then** a verified alternative was published | Operator → Overview → *Pending notification passes* | Press **Run scheduled sync now** (or call the cron). The citizen receives a **follow-up update** with the Case A text, exactly once |
| **D** | Old notice past its expiry, still `ACTIVE` | Operator → Overview → *Past expiry* | Never shown to citizens; the next sync archives it as `EXPIRED` |
| **E** | Two **conflicting** verified notices, same ward/service/day (Ward 2) | Operator → Overview → *Conflicts* | Not merged. Flagged for review; the most recently verified one wins |
| **F** | **Unverified** notice with an unverified alternative (Ward 3) | Operator → Overview → *Awaiting verification* | Nothing sent until an operator verifies it; the dialog previews the exact message |

**Operator → Overview → Refresh demo scenarios** re-dates A–F to today at any time. It only touches demo rows.

The two paper templates as they render from the seeded data:

```text
Garbage Collection Update. Your regular Monday collection is affected by a municipal holiday. Alternative collection: Wednesday, 7:00 AM. Source: Verified municipal notice. Please keep your waste ready according to the updated schedule.

Garbage Collection Alert. Your regular Monday collection is affected by a municipal holiday. No verified alternative collection schedule has been published yet. We will notify you when verified information becomes available.
```

### Probing the API directly

```bash
# 1. Get an access token for a demo account (Supabase password grant)
TOKEN=$(curl -s "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "content-type: application/json" \
  -d '{"email":"citizen@civicai.example","password":"CivicAI-Citizen-2026"}' | jq -r .access_token)

# 2. A CITIZEN calling an OPERATOR-only route → 403
curl -i -X POST "$APP/api/events" -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"serviceId":"demo_svc_gc_1","eventType":"holiday","affectedDate":"2030-01-07","reason":"x","source":"y"}'

# 3. Cron without the secret → 401; with it → 200
curl -i "$APP/api/cron/sync"
curl -i -X POST "$APP/api/cron/sync" -H "x-cron-secret: $CRON_SECRET"
curl -s -X POST "$APP/api/cron/sync" -H "x-cron-secret: $CRON_SECRET"   # run twice: notificationsCreated is 0 the second time

# 4. Someone else's complaint (or a made-up id) → 404, never 500
curl -i "$APP/api/complaints/does-not-exist" -H "authorization: Bearer $TOKEN"

# 5. Health check (reports which integrations are configured, never their values)
curl -s "$APP/api/health"
```

---

## Architecture

The paper's FastAPI and Next.js pair becomes one Next.js app. Its Route Handlers act as the API and orchestration layer: the responsibilities are the same, but there is one deployable unit on Vercel.

```text
                         ┌──────────────────────────────────────────────────────────────┐
  MCC circulars /        │ 1. MUNICIPAL INFORMATION LAYER                               │
  operator phone   ───►  │    /operator/events/new  (manual entry, or paste text →      │
  calls / notices        │    AI extraction DRAFT that the operator reviews & submits)  │
                         └──────────────────────────────┬───────────────────────────────┘
                                                        │  CivicEvent (UNVERIFIED)
                         ┌──────────────────────────────▼───────────────────────────────┐
                         │ 2. VERIFICATION LAYER   src/lib/verification.ts  (no AI)     │
                         │    UNVERIFIED → VERIFIED / UNAVAILABLE, OPERATOR only,        │
                         │    source required, VERIFIED is locked, optimistic locking    │
                         └──────────────────────────────┬───────────────────────────────┘
                                                        │  VERIFIED event (+ arrangements)
       ┌────────────────────────────────────────────────▼───────────────────────────────┐
       │ 4. CITIZEN NOTIFICATION LAYER  src/lib/notifications/*                          │
       │    buildNotification() (§12) → deterministic templates (§5/§6.2)                │
       │    immediate pass on verify/withdraw + scheduled sync via /api/cron/sync        │
       │    ward targeting via turf.js · dedup by UNIQUE contentHash · in-app + email    │
       └──────────────┬────────────────────────────────────────────────┬────────────────┘
                      │ rendered English text only                      │ Notification rows
       ┌──────────────▼──────────────────────┐          ┌───────────────▼────────────────┐
       │ 3. CIVIC INTELLIGENCE  src/lib/ai/* │          │  Citizen PWA-style UI           │
       │  translate · rephrase · Q&A ·       │          │  /dashboard /notifications      │
       │  extraction draft · complaint draft │──────────►  /ask (grounded Q&A)            │
       │  ► HALLUCINATION FIREWALL (guard.ts)│  checked │  EN + ಕನ್ನಡ                     │
       │  no DB access at all (lint-enforced)│  text    └───────────────┬────────────────┘
       └─────────────────────────────────────┘                          │
                         ┌──────────────────────────────────────────────▼───────────────┐
                         │ 5. FEEDBACK & COMPLAINT LAYER  /report → /operator/complaints │
                         │    AI draft needs citizen approval · photo + optional location│
                         └──────────────────────────────────────────────────────────────┘
        AuditLog (every verify / withdraw / arrangement verify / firewall rejection) ◄── all layers
```

**Alternative Civic Service Arrangement model** (paper §10), as data:

```text
Service (normal schedule) + CivicEvent (disruption) → affected collection
  → operator decision → AlternativeArrangement (0..n) → verification → Notification
```

A `CivicEvent` with **zero** `AlternativeArrangement` rows is how the schema represents "no verified alternative". It is not a null edge case added later.

| Paper layer | Code |
|---|---|
| 1. Municipal Information | `src/app/(operator)/operator/events/new`, `src/components/operator/event-form.tsx`, `POST /api/events`. There is no live MCC scraper in this prototype; that scope boundary is intentional. |
| 2. Verification | `src/lib/verification.ts` (pure, no AI), `POST /api/events/[id]/verify`, `POST /api/arrangements/[id]/verify` |
| 3. Civic Intelligence | `src/lib/ai/{client,extract,translate,answer,draft,guard}.ts` |
| 4. Citizen Notification | `src/lib/notifications/{templates,engine,plan,sync,dispatch,delivery,prisma-store}.ts`, `src/app/api/cron/sync` |
| 5. Feedback & Complaint | `src/app/(citizen)/(app)/report`, `src/app/api/complaints`, `src/app/(operator)/operator/complaints` |

---

## How the principle is enforced

| Safeguard (paper §14) | Concrete, checkable mechanism |
|---|---|
| **No AI authority** | Only `requireOperator()`-gated route handlers write `CivicEvent` / `AlternativeArrangement`. `src/lib/ai/**` cannot import `@/lib/db`, `@prisma/client` or the audit module: an ESLint `no-restricted-imports` rule enforces this, and `tests/architecture.test.ts` checks it independently. |
| **Deterministic messages** | `render()` builds alerts only from fields of the verified records (`templates.ts`). The LLM may only translate or rephrase an already-rendered string. |
| **Hallucination firewall** | `src/lib/ai/guard.ts` `validateAgainstSource()` extracts every date, time, day name, relative-day word ("tomorrow"), bare number and known place name from the AI output, in English or Kannada and in any normal form ("7 AM" = "07:00" = "ಬೆಳಿಗ್ಗೆ 7:00"). Each token must appear in the source fields the model was given; translation also requires every source token to survive. On failure the AI text is discarded, the deterministic text is shown, and an `ai.guard_rejected` AuditLog row is written. `tests/lib/guard.test.ts` feeds deliberately tampered responses (8:00 instead of 7:00, Thursday instead of Wednesday, AM↔PM flips, invented dates and "tomorrow") and asserts rejection plus fallback. |
| **Grounded Q&A** | The model receives only the citizen's ward's **verified** rows (unverified alternatives are excluded). It must return `answerable`, `answer` and `cited_record_ids` as structured output. In code: not answerable → the exact sentence *"I don't have verified information about that yet."*; no valid citation → the same sentence; firewall failure → deterministic summary. |
| **No side door to the data** | Row-level security on every table blocks Supabase's public Data API, so the only way to write a schedule is through the role-checked API routes. Checked by `tests/architecture.test.ts` and against real Postgres in `tests/integration/sync.db.test.ts`. |
| **Source transparency** | `EventCardProps` makes `source`, `verificationStatus` and `lastVerifiedAt` **required** keys, so a card cannot render without them. `null` renders as "Not yet verified". |
| **Human oversight** | `/api/ai/extract` returns a **draft** only. Dates or times the model computed that aren't written in the text are dropped with a warning; malformed output goes to "Could not parse — fill in manually". |
| **Explicit uncertainty** | VERIFIED, UNVERIFIED and UNAVAILABLE are three first-class visual treatments with the §6.2 wording, never a hidden or null case. |
| **Citizen control** | AI complaint drafts only fill the textarea. Submission is a separate, explicit `POST /api/complaints` by the citizen. |
| **Auditability** | Every verify, mark-unavailable, withdraw, arrangement verify, firewall rejection, dispatch, sync run and complaint triage writes an `AuditLog` row. `/operator/audit-log` is read-only, and no API can edit or delete entries. |
| **Degraded mode** | Without `GEMINI_API_KEY`, or on any AI timeout, free-tier quota exhaustion (429), safety block or malformed output, alerts, verification and complaints keep working unchanged. Only the AI enhancements fall back, with a calm "AI assistance is temporarily unavailable" notice. |

---

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript, `src/`). Route Handlers form the API/orchestration layer. |
| UI | Tailwind CSS, shadcn/ui components (Radix primitives), lucide-react, sonner |
| Database | Supabase Postgres, through Prisma 6 (Transaction pooler `DATABASE_URL` + Session pooler `DIRECT_URL`) |
| Auth / storage | Supabase Auth (email + password, roles `CITIZEN` / `OPERATOR`); Supabase Storage private bucket `complaint-photos` |
| GIS | GeoJSON ward polygons + `@turf/turf` point-in-polygon in the app layer |
| Maps | Mapbox GL JS, lazy-loaded, with a searchable list fallback |
| AI | Google Gemini via `@google/genai` (free AI Studio key works), server-only, model from `GEMINI_MODEL`, JSON-schema structured output re-validated by Zod |
| Validation | Zod everywhere (API + `react-hook-form` forms) |
| Scheduling | Vercel Cron → `/api/cron/sync` (secret-protected), daily on the Hobby plan; an optional GitHub workflow keeps it every 6 hours |
| Tests / CI | Vitest + Testing Library; GitHub Actions: lint → typecheck → migrate → test (with Postgres) → build → secret scan |

---

## Environment variables

| Variable | Required | Scope | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | server | Supabase **Transaction pooler** string (port **6543**, `?pgbouncer=true&connection_limit=1`), used by the app at runtime. |
| `DIRECT_URL` | ✅ | server | Supabase **Session pooler** string (port **5432**), used by `prisma migrate`. Not the "Direct connection" host: it is IPv6-only and Vercel cannot reach it. |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | public | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | public | Supabase publishable key (`sb_publishable_…`) or legacy anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **server only** | Supabase secret key (`sb_secret_…`) or legacy service_role key, for private photo storage and the demo seed. Never prefix it with `NEXT_PUBLIC_`. |
| `CRON_SECRET` | ✅ | server | ≥ 16 random characters (`openssl rand -hex 32`). Vercel Cron sends it as `Authorization: Bearer …`; manual calls use `x-cron-secret`. |
| `GEMINI_API_KEY` | optional | **server only** | Enables the AI layer. A free key from [Google AI Studio](https://aistudio.google.com/apikey) works. Unset means template-only (degraded) mode. |
| `GEMINI_MODEL` | optional | server | Defaults to `gemini-3.5-flash-lite` (stable Flash-Lite, the largest free-tier quota). Any Gemini text model ID works. |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | optional | public | Enables the map ward picker. Unset means a searchable list. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | optional | server | Optional email channel; in-app notifications never depend on it. |
| `SEED_DEMO_DATA` | optional | build | `false` disables the demo seed on deploy. |
| `DEMO_CITIZEN_EMAIL`, `DEMO_CITIZEN_PASSWORD`, `DEMO_OPERATOR_EMAIL`, `DEMO_OPERATOR_PASSWORD` | optional | build | Override the demo credentials. **Set your own on a public deployment.** |

`.env.example` lists all of them with placeholders. `.env` is git-ignored, and `npm run check:secrets` (also run in CI) fails if a secret-looking value is tracked or appears in the client bundle.

---

## Local setup

Prerequisites: Node.js ≥ 20.9, npm, and a Supabase project (the free tier is fine).

```bash
npm install
cp .env.example .env        # fill in your Supabase / optional keys
npx prisma migrate dev      # creates the schema
npx prisma db seed          # wards, services, demo accounts, scenarios A–F (prints the credentials)
npm run dev                 # http://localhost:3000
```

Supabase settings:

- **Authentication → Providers → Email**: for a smooth demo, turn off *Confirm email*. When it is on, new sign-ups are told to confirm by email first, and the confirmation link lands on `/auth/callback`. Demo accounts are pre-confirmed by the seed.
- **Authentication → URL configuration**: add `http://localhost:3000` and your Vercel URL as Site URL / redirect URLs.
- The seed creates the private `complaint-photos` bucket.

Make an existing account an operator: `npx tsx scripts/promote-operator.ts someone@example.com`.

Useful scripts: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run check:secrets`, `npm run check:deploy`.

**Gemini (optional).** Create a free key at [Google AI Studio](https://aistudio.google.com/apikey), put it in `.env` as `GEMINI_API_KEY`, then run `npm run ai:smoke`. It makes 2–3 small calls and shows that the model returns the required JSON shape, that a Kannada translation passes the hallucination firewall, and that an unanswerable question gets *"I don't have verified information about that yet."* Without a key, everything except the AI enhancements works unchanged.

---

## Deploying to Vercel

**Follow [DEPLOY.md](DEPLOY.md)** for the step-by-step guide (about 15 minutes). In short:

1. Create a Supabase project in the Mumbai region and turn off **Confirm email**.
2. Copy `.env.example` to `.env.vercel`, fill it in, and run `npm run check:deploy`, which tests your settings against the real project.
3. Import the repo in Vercel, paste `.env.vercel` into the environment variables, and deploy.

`vercel.json` sets the build command to `npm run vercel-build`, which runs `prisma generate` → `prisma migrate deploy` → idempotent demo seed → `next build`. Prisma Client is also generated in `postinstall`, which prevents the classic "works locally, breaks on Vercel" failure. A failed migration stops the build; a failed demo seed only logs a warning, because demo data must never block the real app.

Post-deploy verification:

- [ ] `GET /api/health` → `database: true`, `auth: true`, `storage: true`, `cron: true`
- [ ] Sign up and sign in work; onboarding shows the map with `NEXT_PUBLIC_MAPBOX_TOKEN` and the list without it
- [ ] Demo citizen sees Scenario A and B with the exact paper wording
- [ ] `/api/cron/sync` returns 401 without the secret header and 200 with it; a second run creates 0 notifications
- [ ] Page source and network tab contain no server secret (`npm run check:secrets` checks the built bundle)
- [ ] Phone-width (≈360 px) layout: bottom tab bar, no horizontal scroll

---

## API reference

Every mutating route validates its input with Zod, re-checks the session on the server (cookie, or `Authorization: Bearer <Supabase access token>`) and enforces the role in `src/lib/rbac.ts`. Errors are JSON: `{ "error": { "code", "message", "details?" } }`. Stack traces are never returned.

| Route | Method | Role | Notes |
|---|---|---|---|
| `/api/events` | GET | any signed-in | Filters `wardId`, `status`, `verification`; cursor pagination (`cursor`, `limit` ≤ 50). Citizens only ever receive **VERIFIED** notices. |
| `/api/events` | POST | OPERATOR | Creates an UNVERIFIED notice. Rejects a missing `source` or `affectedDate`, or a past date. **409 `DUPLICATE_NOTICE`** for the same service, IST day, ward and normalised source. Returns any `conflicts`. |
| `/api/events/[id]` | GET | any signed-in | 404 for citizens unless VERIFIED. |
| `/api/events/[id]/verify` | POST | OPERATOR | `{ expectedUpdatedAt, decision?: "VERIFIED" \| "UNAVAILABLE" }`. Writes AuditLog and runs the **immediate** notification pass. **409 `STALE_RECORD`** if someone changed it meanwhile. |
| `/api/events/[id]/withdraw` | POST | OPERATOR | `{ expectedUpdatedAt, reason }`. Sends an immediate **retraction** to everyone already notified. |
| `/api/arrangements` | POST | OPERATOR | Records an UNVERIFIED alternative. |
| `/api/arrangements/[id]/verify` | POST | OPERATOR | `{ expectedUpdatedAt, decision? }`. Requires a VERIFIED, ACTIVE event. Triggers the follow-up pass. |
| `/api/complaints` | GET / POST | citizen (own) or OPERATOR / CITIZEN | POST takes multipart (`photo` optional) or JSON. Text is length-capped. Photos must be JPEG, PNG or WebP **verified by magic bytes**, at most 4 MB. Location is optional. Rate-limited. |
| `/api/complaints/[id]` | GET / PATCH | owner or OPERATOR / OPERATOR | GET returns 404 (never 500) if the complaint is missing or not owned. PATCH is triage with optimistic locking. |
| `/api/complaints/[id]/location` | DELETE | owner | Citizen erases the precise location they shared. |
| `/api/ai/extract` | POST | OPERATOR | Returns a **draft only**; never creates a CivicEvent. |
| `/api/ai/answer` | POST | CITIZEN | Grounded Q&A over the ward's verified rows, behind the firewall. |
| `/api/ai/draft-complaint` | POST | CITIZEN | Returns a draft for the citizen to edit. Never submits. |
| `/api/cron/sync` | GET / POST | `x-cron-secret` or `Authorization: Bearer` = `CRON_SECRET` | 401 otherwise. Fails closed if `CRON_SECRET` is unset. |
| `/api/operator/run-sync` | POST | OPERATOR | Runs the same sync job from the console during demos. |
| `/api/operator/demo-refresh` | POST | OPERATOR | Re-dates demo scenarios A–F. |
| `/api/profile` | PATCH | signed-in | `{ wardId?, language? }`. Only citizens have a ward. |
| `/api/wards`, `/api/wards/resolve` | GET / POST | signed-in | Ward list; `{lat,lng}` → `inside` / `near_boundary` / `ambiguous` / `outside`. Coordinates are never stored. |
| `/api/notifications/[id]/read`, `/read-all`, `/[id]/translate` | POST | owner | The translation is stored only if it passes the firewall. |
| `/api/health` | GET | public | Shows which integrations are configured (booleans only). |

---

## Design decisions

- **turf.js instead of PostGIS.** The paper specifies PostGIS. Prisma does not model PostGIS geometry types natively, so every spatial query would need raw SQL. PostGIS on serverless Postgres with migrations is also a common source of deployment breakage. Ward-level targeting needs only point-in-polygon at onboarding, plus a boundary-distance check for about 65 polygons, which `@turf/turf` does in milliseconds in the app layer with zero extra infrastructure. The same GeoJSON could move to PostGIS later without changing `geo.ts`'s callers. This is a deliberate trade, not a shortcut.
- **Vercel Cron instead of APScheduler.** APScheduler needs a long-lived Python process, which serverless does not provide. Vercel's Hobby plan rejects cron more frequent than once a day, so `vercel.json` runs daily and the optional `.github/workflows/scheduled-sync.yml` calls the same endpoint every 6 hours, as the paper specifies. The paper's 5-step job (§13) is kept as one **idempotent, bounded** invocation: a 500-row budget, a 100-event budget and a 45-second deadline. Unfinished work is resumed by the next run because `notifiedVersion` only advances when an event is fully processed. Verify and withdraw also trigger an **immediate** pass, so the cron is a safety net rather than the latency floor.
- **One Next.js app instead of FastAPI + Next.js.** Same layer responsibilities, one deployable unit, one type system end to end.
- **Change detection: `version` and `notifiedVersion`.** Every change that must reach citizens (verify, arrangement verified, withdrawal) bumps `version`. The pass compares the two values, decides per citizen against their *latest* message (so an unchanged event is never re-sent), and inserts with `UNIQUE(contentHash)` + `skipDuplicates`. Even two overlapping cron runs cannot double-send.
- **Verified records are locked.** Corrections go through withdraw (a retraction is sent) plus a new notice. Silent edits of something citizens were told are impossible.
- **Optimistic concurrency.** Every operator write carries `expectedUpdatedAt` and uses `updateMany(where: {id, updatedAt})`. A stale write returns **409 "This record changed, please refresh"** instead of overwriting.
- **Row-level security with no policies.** Supabase publishes the `public` schema through its Data API, so without RLS anyone with the public key could read and write every table directly, bypassing all role checks. A migration enables RLS on every table with no policies and revokes the `anon` / `authenticated` grants. The app connects through Prisma as the table owner, which RLS does not restrict, so the Data API has no access while the app works normally. Tests assert every table is covered.
- **Duplicates vs conflicts.** A *duplicate* is the same service, IST day, ward and normalised source; it is blocked by a UNIQUE `dedupKey`, which is released on withdrawal. A *conflict* is a different notice for the same ward, service and day; it is never auto-merged, it is flagged on the operator overview, and citizens see and are notified about only the most recently verified one.
- **Default expiry.** A notice stays current until the night before the next regular collection day, or until its verified alternative has happened. Display queries also filter by expiry, so an expired notice is never shown as current even before the cron archives it.
- **Photo cap 4 MB.** Vercel serverless functions reject request bodies above 4.5 MB, so the spec's "e.g. 5 MB" is set just under the platform limit.
- **DB-backed rate limiting** for AI and complaint endpoints. In-memory counters reset on every cold start.
- **Gemini free tier, structured outputs.** All Gemini calls request JSON via `responseJsonSchema` (generated from the same Zod schema) with temperature 0, and the reply is re-validated with Zod. Safety blocks, truncation, timeouts, quota errors (429) and parse failures all map to one `AiUnavailableError`, which leads to deterministic behaviour. The SDK's default retry policy (up to 5 attempts, 60 s back-off) is replaced by a single quick retry on 5xx and none on 429, so an exhausted free quota degrades immediately instead of hanging a serverless function. Free-tier quotas are small and change without notice; the DB-backed per-user rate limits keep usage within them, and the app is fully functional without any key.
- **Only the latest *verified* alternative is ever announced**, and the Q&A context never includes unverified alternatives. The dashboard shows them only with the explicit §6.2 *"A possible alternative may be …"* wording and an "Unverified" badge.

---

## Edge-case checklist → implementation

| Edge case | Where |
|---|---|
| No verified alternative → Case B, never a fabricated time | `engine.ts`, `templates.ts`; `tests/lib/engine.test.ts` |
| Alternative published after a "no alternative yet" alert → follow-up | `plan.ts` (latest-message diff), `sync.ts`; `tests/cron/sync.test.ts`, `tests/integration/sync.db.test.ts`; Scenario C |
| Withdrawn notice → immediate retraction to everyone notified (even if they moved ward) | `withdraw/route.ts`, `plan.ts`; sync tests |
| Past expiry → archived, never shown as current | `sync.ts` expiry pass + `isCurrent()` in every citizen query; Scenario D |
| Point on or near a ward boundary | `geo.ts` (40 m tolerance; nearest centroid wins and must be confirmed; a tie within 25 m is *ambiguous*, so the citizen must choose); `tests/lib/geo.test.ts` |
| Citizen without a ward | `(citizen)/(app)/layout.tsx` forces onboarding; `requireWard()` returns 409 `WARD_REQUIRED` in the APIs |
| Conflicting notices | `conflicts.ts`; operator overview; Scenario E; `tests/lib/conflicts.test.ts` |
| Duplicate ingestion | `eventDedupKey` + UNIQUE column, 409 `DUPLICATE_NOTICE` |
| Malformed or partial AI JSON | `extract.ts` returns `could_not_parse`; `tests/lib/extract-and-image.test.ts` |
| AI output with an unsupported date, time or place | `guard.ts`; `tests/lib/guard.test.ts` |
| AI key missing, rate-limited or timing out | `client.ts` raises `AiUnavailableError`, and every caller falls back deterministically |
| CITIZEN calls an OPERATOR route → 403 | `rbac.ts`; `tests/rbac.test.ts` (calls the real route handlers; the DB is a tripwire proving the role check comes first). Operator *pages* are also guarded twice: in the layout, and by `requireOperatorPage()` in every page, because layouts don't re-run on client-side navigation |
| Secrets never in the client | `server-only` imports, ESLint rules, `tests/architecture.test.ts`, `scripts/check-secrets.ts` in CI |
| Cron without the secret → 401 | `src/lib/cron-auth.ts` (constant-time compare, fails closed); `tests/rbac.test.ts` |
| Parameterised SQL only | Prisma throughout; the architecture test forbids `$queryRawUnsafe` / `$executeRawUnsafe` |
| Photo upload | MIME allowlist, magic-byte sniffing, 4 MB cap, private bucket, short-lived signed URLs |
| Stored XSS | Plain-text storage, React escaping, no `dangerouslySetInnerHTML` (lint + test) |
| Concurrent operator edits | `expectedUpdatedAt` optimistic checks return 409 `STALE_RECORD` |
| Ward change after being notified | Notifications are immutable snapshots; new-ward alerts only (`notifyCitizenOfCurrentEvents`) |
| Empty states | Every list has a designed `EmptyState` |
| 404 for missing or un-owned complaints and events | API routes and `/report/[id]` (`notFound()`) |
| UTC storage, IST display and day logic | `src/lib/time.ts` (fixed +05:30, server-timezone independent); `tests/lib/time.test.ts` |
| Mobile (≈360 px) | Mobile-first layouts, bottom tab bar, native selects |
| Missing Mapbox token | The map is not loaded and the searchable list is used; map errors also fall back to the list |
| Prisma connection exhaustion | Transaction pooler `DATABASE_URL` (6543, `pgbouncer=true`) + Session pooler `DIRECT_URL` for migrations; `npm run check:deploy` validates both |
| Prisma on Edge | Every API route sets `runtime = "nodejs"` (checked by a test); middleware never imports Prisma |

---

## Privacy

- **Routine targeting uses only `wardId`.** A map pin or "use my location" point is sent once to `/api/wards/resolve`, used to compute the ward, and neither stored nor logged.
- **A precise location is collected only with a complaint**, only if the citizen opts in, and the citizen can delete it at any time from the complaint tracker (`DELETE /api/complaints/[id]/location`).
- Complaint photos live in a **private** bucket and are viewed through 10-minute signed URLs.
- **AI and data use.** On Google's free Gemini tier, prompts may be used by Google to improve its products. CivicAI only sends already-public notice text, the citizen's question, or their complaint notes — never names, emails, ward membership or locations. Use a paid-tier key for a real deployment.
- Past notifications are immutable records of what was sent. Changing ward does not rewrite them.

---

## Testing & CI

```bash
npm run test                         # unit + component + route tests
TEST_DATABASE_URL=postgresql://… npm run test   # also runs the PostgreSQL integration test
```

| Test | Proves |
|---|---|
| `tests/lib/guard.test.ts` | **The hallucination firewall** rejects tampered AI output and falls back to deterministic text. This is the executable proof of the paper's central claim. |
| `tests/lib/engine.test.ts` | Every branch of `buildNotification()`, plus exact Case A, Case B and §6.2 wording |
| `tests/rbac.test.ts` | CITIZEN → 403 on every operator route, OPERATOR → 403 on citizen routes, 401 signed out, cron 401, validation before any DB access |
| `tests/lib/geo.test.ts` | Inside, outside, near-boundary, exactly-on-boundary and corner cases |
| `tests/cron/sync.test.ts` | Running sync twice creates no duplicates, plus follow-ups, retractions, expiry, lookahead, row budget and conflicts |
| `tests/integration/sync.db.test.ts` | The same guarantees against real PostgreSQL with the seeded scenarios, including the DB rejecting a duplicate `contentHash` |
| `tests/architecture.test.ts` | No AI authority, no secrets in client code, Node.js runtime on every API route, no raw HTML or unsafe SQL, RLS on every table, Hobby-safe cron |
| `tests/deploy-env.test.ts` | The deploy checker catches the IPv6-only host, swapped ports, leftover placeholders and a secret key in a public variable |
| others | i18n fallback, verification state machine, IST boundaries, extraction parsing, photo sniffing, EventCard states |

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request: **lint → typecheck → migrate (Postgres service) → test → build → secret scan**.

---

## Limitations

These mirror the paper's §17.

- **The municipality must publish disruptions.** CivicAI only relays what MCC or an authorized operator has verified. If nothing is published, citizens are told exactly that. There is no live MCC data feed or scraper in this prototype; notices are entered by operators.
- **Ward-level targeting can be coarse.** A disruption affecting part of a ward reaches the whole ward. The arrangement's free-text `affectedArea` narrows the message but not the audience.
- **Illustrative demo ward boundaries.** The four seeded wards are simple rectangles around central Mysuru, *not* official MCC ward shapefiles. A real deployment would import them from MCC or Survey of India. The cited city figures should also be re-verified.
- **Uneven digital reach.** A smartphone/web channel excludes residents without devices, connectivity or literacy. **SMS, push notifications and IVR are out of scope** for this prototype (future work); email via Resend is optional.
- AI features (Kannada translation, Q&A, drafting) depend on Google's Gemini API, whose free-tier quota is small and can change without notice. Without it they degrade to English templates. The operator console is English-only.
- Demo circular numbers ("MCC Circular No. 114/2026") and sources are fictitious.

---

## Objectives & research questions → where they are demonstrated

> The objective and RQ wording below is paraphrased from the project synopsis. **Align the numbering and exact wording with the final paper before submission.**

| # | Objective (paraphrased) | Demonstrated in |
|---|---|---|
| O1 | Model normal schedules, disruptions and alternative arrangements explicitly | Prisma schema (`Service`, `CivicEvent`, `AlternativeArrangement`); zero-arrangement events represent "no alternative" |
| O2 | Verify every disruption and alternative before citizens are told | `verification.ts`; operator verify dialogs; `/api/*/verify` |
| O3 | Notify only affected citizens, at ward level | `geo.ts` + `buildNotification()`; onboarding ward picker |
| O4 | Be proactive (inform before the missed collection) | Immediate pass on verify; 7-day lookahead in `/api/cron/sync` |
| O5 | State uncertainty plainly instead of guessing | Case B template, §6.2 three-state cards, Q&A "no verified information" sentence |
| O6 | Use AI only for language assistance, never for schedule authority | `src/lib/ai/*` (no DB access), hallucination firewall + test |
| O7 | Support English and Kannada | `locales/en.json`, `locales/kn.json`, firewall-checked translations, deterministic Kannada status lines |
| O8 | Give citizens a feedback and complaint channel with tracking | `/report`, `/report/[id]`, `/operator/complaints` |
| O9 | Keep the system transparent and auditable | Source + last-verified on every card; `/operator/audit-log` |
| O10 | Protect citizen privacy | Ward-only targeting, opt-in deletable complaint location, private photo storage |

| # | Research question (paraphrased) | Where it is answered |
|---|---|---|
| RQ1 | How can disruption information be turned into reliable, citizen-facing alerts? | Information → Verification → Notification pipeline; Scenarios A–C |
| RQ2 | How can AI help citizens without fabricating schedules? | Firewall (`guard.ts`) + `tests/lib/guard.test.ts`; degraded mode |
| RQ3 | How should the system communicate when no alternative exists? | Case B, the §5 fallback sentence and the UNAVAILABLE state (Scenario B) |
| RQ4 | How can alerts reach the right citizens? | turf.js ward resolution with boundary rules; `citizenInWard()` targeting; `tests/lib/geo.test.ts` |
| RQ5 | How can feedback and accountability close the loop? | Complaint tracker, operator triage with citizen-visible notes, audit log |
