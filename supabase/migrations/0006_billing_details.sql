-- ============================================================================
-- Migration 0006: Billing details for the doctor billing page
--
--   1. doctor_subscriptions  — saved card metadata + billing contact
--   2. subscription_payments — per-payment status, invoice/receipt links
--   3. billing_webhook_events — raw provider events, UNIQUE per event id so a
--      replayed webhook is a no-op no matter which event type it carries
--
-- CARD DATA: we never store a card number. The doctor types their card on the
-- provider's hosted checkout; the webhook returns only brand, last four digits
-- and expiry. The card_last4 CHECK below is exactly four digits, so a full PAN
-- cannot physically be written into this column.
--
-- Additive and safe to run more than once. Requires 0004.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Saved payment method + billing contact on the subscription
-- ----------------------------------------------------------------------------
alter table public.doctor_subscriptions
  add column if not exists card_brand         text,
  add column if not exists card_last4         text,
  add column if not exists card_exp_month     smallint,
  add column if not exists card_exp_year      smallint,
  add column if not exists billing_email      text,
  add column if not exists provider_price_id  text,
  add column if not exists last_payment_at    timestamptz,
  add column if not exists last_payment_status text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'doctor_subscriptions_card_last4_ck'
  ) then
    alter table public.doctor_subscriptions
      add constraint doctor_subscriptions_card_last4_ck
      check (card_last4 is null or card_last4 ~ '^[0-9]{4}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'doctor_subscriptions_card_exp_ck'
  ) then
    alter table public.doctor_subscriptions
      add constraint doctor_subscriptions_card_exp_ck
      check (
        (card_exp_month is null or card_exp_month between 1 and 12)
        and (card_exp_year is null or card_exp_year between 2000 and 2100)
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'doctor_subscriptions_last_payment_status_ck'
  ) then
    alter table public.doctor_subscriptions
      add constraint doctor_subscriptions_last_payment_status_ck
      check (last_payment_status is null
             or last_payment_status in ('paid','failed','refunded','pending'));
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Payment ledger: outcome + the documents a doctor expects to download
-- ----------------------------------------------------------------------------
alter table public.subscription_payments
  add column if not exists status         text not null default 'paid',
  add column if not exists description    text,
  add column if not exists invoice_url    text,
  add column if not exists receipt_url    text,
  add column if not exists card_brand     text,
  add column if not exists card_last4     text,
  add column if not exists failure_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'subscription_payments_status_ck'
  ) then
    alter table public.subscription_payments
      add constraint subscription_payments_status_ck
      check (status in ('paid','failed','refunded','pending'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'subscription_payments_card_last4_ck'
  ) then
    alter table public.subscription_payments
      add constraint subscription_payments_card_last4_ck
      check (card_last4 is null or card_last4 ~ '^[0-9]{4}$');
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Webhook audit + idempotency for every event type, not just payments.
--    The provider retries until we 200; the UNIQUE key makes retries harmless.
-- ----------------------------------------------------------------------------
create table if not exists public.billing_webhook_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  event_id     text not null,
  event_type   text not null,
  doctor_id    uuid references public.profiles(id) on delete set null,
  payload      jsonb,
  processed_at timestamptz,
  error        text,
  created_at   timestamptz not null default now(),
  unique (provider, event_id)
);

create index if not exists billing_webhook_events_created_idx
  on public.billing_webhook_events(created_at desc);

-- Billing stays server-only: no anon/authenticated policies, so only the
-- service role (our API) can read or write any of it.
alter table public.billing_webhook_events enable row level security;

commit;
