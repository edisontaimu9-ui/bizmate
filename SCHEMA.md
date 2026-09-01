# BizMate Database Schema

The schema lives at **`db/schema.sql`** — that's the source of truth (Postgres
via Supabase). Run it once in the Supabase SQL editor (or `supabase db push`
if you use the CLI) to create all tables.

## Tables
`users`, `businesses`, `business_members`, `business_settings`, `products`
(products and services share one table via a `type` column — see comment in
`db/schema.sql` for why), `knowledge_items`, `customers`, `conversations`,
`messages`, `whatsapp_accounts`, `webhook_events`.

## Isolation
Every tenant table has a `business_id` column. The Worker resolves
`business_id` server-side from the authenticated Firebase uid's
`business_members` row on every request — it never trusts a `business_id`
sent by the client (see `worker/src/middleware/requireBusiness.js`). Row
Level Security is enabled on every tenant table with no policies defined,
as a second layer — see the comment block at the bottom of `db/schema.sql`
for why RLS policies aren't the primary boundary here (auth is Firebase, not
Supabase Auth, so Postgres can't natively check "is this row mine" from the
client's JWT).
