-- Solvic — Missed-Call Text Back + Follow-Up Sequences
-- Run this in the Supabase SQL editor on a fresh project.

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  twilio_number text not null unique,          -- E.164, e.g. +12395551234
  booking_url text,                            -- Cal.com link, injected into messages
  business_hours jsonb,
  missed_call_message text not null default
    'Sorry we missed your call! This is {{business_name}} — reply here and we''ll get right back to you.',
  followups_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  phone text not null,                         -- E.164
  name text,
  source text not null default 'missed_call',  -- missed_call | inbound_sms | import | form
  opted_out boolean not null default false,    -- set true on STOP
  created_at timestamptz not null default now(),
  unique (client_id, phone)
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  status text not null default 'open',         -- open | replied | booked | closed
  followup_step int not null default 0,        -- how many sequence steps sent
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction text not null,                     -- inbound | outbound
  kind text not null default 'manual',         -- missed_call | followup | manual | inbound
  body text not null,
  twilio_sid text,
  sent_at timestamptz not null default now()
);

create table call_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  contact_id uuid references contacts(id),
  from_phone text not null,
  call_sid text,
  call_status text not null,                   -- no-answer | busy | failed | completed
  texted_back boolean not null default false,
  occurred_at timestamptz not null default now()
);

create index idx_contacts_client_phone on contacts (client_id, phone);
create index idx_conversations_contact on conversations (contact_id);
create index idx_conversations_open on conversations (status, last_message_at);
create index idx_messages_conversation on messages (conversation_id, sent_at);
create index idx_call_events_client on call_events (client_id, occurred_at desc);
