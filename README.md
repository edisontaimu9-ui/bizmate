# BizMate

"Your business. Your knowledge. Your assistant."

A WhatsApp business assistant for small businesses: owners configure their
business info, products, and FAQs; customers chat via WhatsApp; the
assistant answers only from that configured knowledge and hands off to a
human when it can't.

Read **agent.md** first — it explains the stack choices (adapted for a
no-build-toolchain / Termux dev environment) and current phase status.
Read **db/schema.sql** for the full data model.

## Status: Phase 1 complete

- Project scaffolding (Worker + static frontend, no bundler)
- Postgres schema on Supabase (`db/schema.sql`)
- Firebase Auth (email/password) on the frontend — Auth only, no Firestore,
  no Firebase Storage
- Worker-side ID token verification (`worker/src/lib/verifyIdToken.js`)
- Business creation with proper tenant isolation (`business_members` +
  server-side `business_id` resolution — see
  `worker/src/middleware/requireBusiness.js`)

Not yet built: products/knowledge management, the assistant engine, test
chat, conversations/handoff, WhatsApp webhook. See `agent.md` for the phase
list.

## One-time setup

1. **Firebase project** (console.firebase.google.com) — Auth only:
   - Enable Authentication → Email/Password. Don't need Firestore or
     Storage for anything in this app.
   - Project Settings → General → add a Web app → copy the config into
     `public/js/firebase-config.js`.

2. **Supabase project** (supabase.com):
   - Create a project.
   - SQL Editor → paste and run `db/schema.sql`.
   - Project Settings → API → copy the **Project URL** and the
     **service_role key** (not the anon key — the Worker needs service_role
     to bypass RLS as the trusted server; see the note at the bottom of
     `db/schema.sql`).

3. **Configure the Worker**:
   ```
   cd worker
   npm install
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```
   Edit `wrangler.toml` and set `FIREBASE_PROJECT_ID` and `SUPABASE_URL` to
   your real values.

4. **Run locally**:
   ```
   cd worker
   npx wrangler dev
   ```
   Update `API_BASE_URL` in `public/js/firebase-config.js` to
   `http://localhost:8787` while testing locally.

5. **Serve the frontend** — no build step. Any static server works, e.g.:
   ```
   cd public
   npx serve .
   ```
   Or open `public/index.html` directly — some browsers restrict ES module
   imports over `file://`, so a static server is more reliable.

## Deploying

```
cd worker
npx wrangler deploy
```
Then point `API_BASE_URL` at the deployed `*.workers.dev` URL (or your
custom domain), and publish `public/` to GitHub Pages / Cloudflare Pages.

## Phases

See `agent.md` for the full phase checklist and what's next.
