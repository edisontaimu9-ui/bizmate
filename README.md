# BizMate

"Your business. Your knowledge. Your assistant."

A WhatsApp business assistant for small businesses: owners configure their
business info, products, and FAQs; customers chat via WhatsApp; the
assistant answers only from that configured knowledge and hands off to a
human when it can't.

Read **agent.md** first — it explains the stack choices (adapted for a
no-build-toolchain / Termux dev environment) and current phase status.
Read **db/schema.sql** for the full data model.

## Status: Phase 5 complete

- Project scaffolding (Worker + static frontend, no bundler)
- Postgres schema on Supabase (`db/schema.sql`)
- Firebase Auth (email/password + Google) — Auth only, no Firestore, no
  Firebase Storage
- Business creation with proper tenant isolation
- Products/services CRUD with photo upload
- Knowledge (FAQs + instructions) CRUD with optional file attachment
- File uploads via Supabase Storage signed URLs
- Assistant engine: answers only from the business's own enabled products
  and knowledge, refuses to invent details
- Test Chat dashboard page
- Conversations + messages persisted to Postgres; a Conversations dashboard
  page (list + thread view) with human handoff — take over, reply
  yourself, return to the assistant, or close
- A **simulate incoming message** tool (Conversations page) that exercises
  the full pipeline without needing WhatsApp credentials
- **Real WhatsApp Cloud API integration**: a public webhook
  (`worker/src/routes/whatsappWebhook.js`) that verifies with Meta,
  authenticates inbound requests via X-Hub-Signature-256 (not a bearer
  token, since Meta doesn't send one), and shares the exact same
  persistence/handoff/reply pipeline the simulate tool uses. A WhatsApp
  dashboard page to connect a business's Meta Phone Number ID.

Not yet built: Phase 6 (security hardening, rate limiting, production
readiness). See `agent.md` for details.

## Connecting WhatsApp (Phase 5 setup — beyond the one-time setup below)

1. Create a Meta app at developers.facebook.com, add the WhatsApp product.
   Meta auto-generates a free test phone number — no real SIM needed to
   start.
2. In the app's WhatsApp → Configuration settings, set the webhook:
   - **Callback URL**: `https://<your-worker>.workers.dev/webhooks/whatsapp`
   - **Verify token**: any value you choose — set the same value as the
     `WHATSAPP_WEBHOOK_VERIFY_TOKEN` secret below
   - Subscribe to the **messages** field
3. Set the Worker secrets (see step 3 below) — `WHATSAPP_ACCESS_TOKEN` and
   `WHATSAPP_PHONE_NUMBER_ID` come from the same WhatsApp → API Setup page;
   `WHATSAPP_APP_SECRET` comes from App Settings → Basic.
4. In the app, add your own phone number as a test recipient (WhatsApp →
   API Setup → "To" field management).
5. On the BizMate dashboard's **WhatsApp** page, paste in the Phone Number
   ID and save — this tells BizMate which business owns that number.
6. Message the test number from your own WhatsApp. It should show up in
   **Conversations** and get a real reply back on WhatsApp.

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
   - **Storage** → Create a new bucket named exactly `bizmate` → mark it
     **Public**. That's it — no policies needed, since the Worker always
     signs uploads with the service_role key (which bypasses RLS/policies
     entirely), and a public bucket serves reads with no auth required.

3. **Configure the Worker**:
   ```
   cd worker
   npm install
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   npx wrangler secret put LLM_API_KEY
   ```
   Get an `LLM_API_KEY` from console.groq.com (free tier available) — or
   any OpenAI-compatible provider, in which case also set `LLM_BASE_URL`
   and `LLM_MODEL` in `wrangler.toml`.
   Edit `wrangler.toml` and set `FIREBASE_PROJECT_ID` and `SUPABASE_URL` to
   your real values.
   For WhatsApp (see the dedicated section below for the full flow):
   ```
   npx wrangler secret put WHATSAPP_ACCESS_TOKEN
   npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID
   npx wrangler secret put WHATSAPP_WEBHOOK_VERIFY_TOKEN
   npx wrangler secret put WHATSAPP_APP_SECRET
   ```

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
