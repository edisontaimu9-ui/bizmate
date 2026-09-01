-- BizMate schema (Supabase / Postgres)
-- Run this in the Supabase SQL editor, or via `supabase db push` if you use
-- the Supabase CLI locally.

create extension if not exists pgcrypto; -- for gen_random_uuid()

-- Users are Firebase Auth users — id is the Firebase uid (text), not a
-- Postgres-generated UUID. Auth itself stays on Firebase; this table is
-- just our profile record, created by the Worker right after signup.
create table users (
  id text primary key,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  location text not null default '',
  phone text not null default '',
  owner_uid text not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  uid text not null references users(id),
  role text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  unique (business_id, uid)
);
create index idx_business_members_uid on business_members(uid);
create index idx_business_members_business on business_members(business_id);

create table business_settings (
  business_id uuid primary key references businesses(id) on delete cascade,
  opening_hours jsonb not null default '{}'::jsonb,
  delivery text not null default '',
  payment_methods text[] not null default '{}',
  policies text not null default '',
  updated_at timestamptz not null default now()
);

-- Products and services share a table (type column) — a service is just a
-- product without physical stock; same fields, same CRUD, no behavioral
-- difference at MVP stage. Splitting them would duplicate the whole surface
-- for no benefit.
create table products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  type text not null default 'product' check (type in ('product', 'service')),
  name text not null,
  description text not null default '',
  price numeric(12, 2),
  currency text not null default 'MWK',
  category text not null default '',
  availability text not null default 'available' check (availability in ('available', 'unavailable')),
  enabled boolean not null default true,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_products_business on products(business_id);

create table knowledge_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  type text not null check (type in ('faq', 'instruction')),
  question text,
  answer text,
  content text,
  enabled boolean not null default true,
  file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_knowledge_business on knowledge_items(business_id);

create table customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  whatsapp_number text not null,
  name text,
  first_seen_at timestamptz not null default now(),
  last_message_at timestamptz,
  unique (business_id, whatsapp_number)
);
create index idx_customers_business on customers(business_id);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  status text not null default 'assistant' check (status in ('assistant', 'human', 'closed')),
  last_message_preview text not null default '',
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_conversations_business on conversations(business_id);
create index idx_conversations_customer on conversations(customer_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender text not null check (sender in ('customer', 'assistant', 'owner')),
  text text not null,
  whatsapp_message_id text,
  created_at timestamptz not null default now()
);
create index idx_messages_conversation on messages(conversation_id);
create index idx_messages_business on messages(business_id);

create table whatsapp_accounts (
  business_id uuid primary key references businesses(id) on delete cascade,
  phone_number_id text,
  waba_id text,
  status text not null default 'disconnected' check (status in ('connected', 'disconnected')),
  connected_at timestamptz
);

create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete set null,
  source text not null default 'whatsapp',
  raw_payload jsonb not null,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Row Level Security: enabled on every tenant table, with NO policies
-- defined. That means the anon/authenticated Supabase keys get zero access
-- by default. This matters because auth in this app is Firebase, not
-- Supabase Auth — so Postgres has no reliable way to check "is this row
-- mine" from a client-supplied JWT. The real trust boundary is the Worker,
-- which uses the service_role key (bypasses RLS entirely) and always
-- resolves business_id from the caller's verified Firebase uid before
-- querying — see worker/src/middleware/requireBusiness.js. RLS here is
-- defense-in-depth: even if the service_role key ever leaked into a client
-- bundle by mistake, these policies are what you'd tighten next, not what
-- you're relying on today.
alter table businesses enable row level security;
alter table business_members enable row level security;
alter table business_settings enable row level security;
alter table products enable row level security;
alter table knowledge_items enable row level security;
alter table customers enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table whatsapp_accounts enable row level security;
alter table webhook_events enable row level security;
