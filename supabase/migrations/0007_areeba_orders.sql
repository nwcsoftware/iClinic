-- ============================================================================
-- Migration 0007: Areeba (MPGS) card orders
--
-- A card purchase is recorded in subscription_payments the moment it STARTS,
-- with status 'pending' and provider_event_id = the MPGS order id. Nothing is
-- activated until the server queries the gateway and sees CAPTURED.
--
-- That gives us two things:
--   1. Idempotency — provider_event_id is already UNIQUE, so verifying the
--      same order twice cannot extend a subscription twice.
--   2. Reconciliation — any row still 'pending' is a payment we started but
--      never confirmed. The reconcile job re-queries those against the gateway,
--      so a dropped browser redirect can never cost a doctor their money.
--
-- Additive and safe to run more than once. Requires 0004 and 0006.
-- ============================================================================

begin;

alter table public.subscription_payments
  -- How much subscription time this payment buys. Set from the server-side
  -- price table, never from the client.
  add column if not exists months     smallint,
  -- MPGS checkout session, kept for support and debugging.
  add column if not exists session_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'subscription_payments_months_ck'
  ) then
    alter table public.subscription_payments
      add constraint subscription_payments_months_ck
      check (months is null or months between 1 and 24);
  end if;
end $$;

-- The reconcile job's lookup: unresolved attempts, oldest first.
create index if not exists subscription_payments_pending_idx
  on public.subscription_payments(status, created_at)
  where status = 'pending';

commit;
