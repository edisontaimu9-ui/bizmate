# BizMate — Agent Context

Read this file first in every session before touching code.

## What this is
BizMate: "Your business. Your knowledge. Your assistant." A WhatsApp business
assistant for small businesses. Owner configures business info, products,
FAQs. Customers chat via WhatsApp. Assistant answers ONLY from configured
knowledge, hands off to a human when it can't.

## Why this stack (read before suggesting Next.js/Supabase/etc.)
The developer builds from an Android phone via Termux — no native build
toolchain. Every other project in this account (Oasis CNST, Thanzi, Chakudya
API) uses vanilla JS + Firebase + Cloudflare Workers + GitHub Pages, with NO
bundler step. BizMate follows the same pattern:

- **Frontend**: plain HTML/CSS/JS, no build step, no framework. Firebase Auth
  JS SDK loaded via CDN `<script type="module">`. Deploy target: GitHub Pages
  (or Cloudflare Pages, TBD).
- **Backend/API**: Cloudflare Worker (`worker/`), plain JS (no TypeScript
  compile step, no bundler required for basic Workers). Handles: auth token
  verification, all database reads/writes that need server-side trust,
  WhatsApp webhook, LLM calls. Secrets live in Worker environment
  bindings/secrets — never in the frontend.
- **Database**: Supabase (Postgres), accessed over its REST API (PostgREST)
  with the `service_role` key — see `db/schema.sql` for the full relational
  schema and `worker/src/lib/supabase.js` for the client. We use Firebase
  only for Auth, not Firestore/Storage, so there's no Firebase Storage
  dependency at all. Multi-tenant isolation: every tenant table has a
  `business_id` column; the Worker never trusts a `business_id` sent by the
  client — it always re-derives it from the authenticated user's
  `business_members` row before querying. RLS is enabled on every tenant
  table with no policies (defense-in-depth — the real boundary is the
  Worker using the service_role key).
- **Auth**: Firebase Auth ONLY (email/password to start) — no Firestore, no
  Firebase Storage needed. Frontend gets an ID token, sends it as
  `Authorization: Bearer <token>` to the Worker, which verifies it via
  Google's public JWKs (see `worker/src/lib/verifyIdToken.js`).
- **File storage**: Supabase Storage, bucket named `bizmate` (public). The
  Worker generates signed upload URLs scoped to `<products|knowledge>s/<business_id>/...`
  (see `worker/src/lib/supabaseStorage.js` and `worker/src/routes/uploads.js`) —
  the browser uploads bytes directly to Supabase, the Worker never handles
  raw file data. This exists specifically because Firebase Storage wasn't
  available in this account; since Supabase was already the database, it's
  storage too, one fewer service to manage.
- **LLM**: provider-agnostic wrapper in `worker/src/lib/llm.js`, defaults to
  Groq (matches Oasis CNST's existing Groq usage) via its OpenAI-compatible
  endpoint. Swap providers by setting `LLM_BASE_URL`/`LLM_MODEL` — no code
  change needed for anything speaking the OpenAI chat-completions format.
  The anti-hallucination logic lives in `worker/src/lib/assistantContext.js`:
  the system prompt is built fresh per request from the business's enabled
  products + knowledge only, with explicit rules against inventing details
  and against treating business-owner-authored content as instructions
  (prompt-injection mitigation — there are no tools/actions exposed to the
  model here, so a successful injection's worst case is a bad text answer,
  not a harmful action).
- **WhatsApp**: official WhatsApp Cloud API only. Webhook lives at
  `worker/src/routes/whatsappWebhook.js`.

If a future session is tempted to add Next.js, Vite, or any step requiring
`npm run build` to produce the *shipped frontend* — stop and check with the
developer first. Cloudflare Wrangler CLI itself is fine to run from Termux
(it's pure JS / small binary), and so is talking to Supabase over plain
`fetch()` (no SDK needed, see `worker/src/lib/supabase.js` and
`supabaseStorage.js`) — but a heavy React build chain is not.

## Multi-tenancy rule (non-negotiable)
Every Postgres table that holds business data includes `business_id`.
Every Worker route that reads/writes business data first resolves
`business_id` from the authenticated user's membership — never from a client-
supplied field, query param, or body value. See `worker/src/middleware/requireBusiness.js`.

## Phases (see PLAN.md for detail)
- [x] Phase 1: project setup, Postgres schema, auth (signup/login/business creation)
- [x] Phase 2: products/services + knowledge management (incl. Supabase Storage
      for product photos and knowledge file attachments)
- [x] Phase 3: assistant engine + test chat (stateless — real conversations
      persist starting Phase 4)
- [ ] Phase 4: conversations + messages + human handoff
- [ ] Phase 5: WhatsApp Cloud API integration
- [ ] Phase 6: security hardening, rate limiting, prod readiness

## Local dev / deploy (run these on-device, not in this chat's sandbox)
```
cd bizmate/worker
npx wrangler dev          # local worker dev server
npx wrangler deploy       # deploy to Cloudflare
```
Frontend in `public/` needs no build — open `index.html` directly or serve
with any static server / GitHub Pages.

## Env vars / secrets
Non-secret (`wrangler.toml` `[vars]`): `FIREBASE_PROJECT_ID`, `SUPABASE_URL`,
optionally `LLM_BASE_URL`/`LLM_MODEL` (default: Groq's `openai/gpt-oss-120b`).
Secrets (set via `npx wrangler secret put <NAME>`, never commit):
`SUPABASE_SERVICE_ROLE_KEY`, `LLM_API_KEY` (a Groq key by default), `WHATSAPP_ACCESS_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
