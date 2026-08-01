-- ============================================================================
-- Migration 0004: Doctor subscriptions ($9.99/month)
--
--   1. doctor_subscriptions  — one row per doctor, the source of truth for access
--   2. subscription_payments — every payment recorded (manual or provider), with
--      provider_event_id UNIQUE so a replayed webhook can never double-charge
--   3. doctor_has_access()   — the single access rule, used everywhere
--   4. public_doctors        — now hides doctors without an active subscription,
--      so unpaid doctors vanish from the patient app AND the chatbot at once
--   5. a trigger giving every new doctor a 14-day trial automatically
--
-- Existing seeded doctors are granted an active period so the demo keeps working.
-- Safe to run multiple times. Standalone: does not require 0002 or 0003.
-- ============================================================================

begin;

-- Ratings columns (also added by 0002 — repeated so this file stands alone).
alter table public.profiles
  add column if not exists rating numeric(2,1)
    check (rating is null or (rating >= 0 and rating <= 5));
alter table public.profiles
  add column if not exists review_count integer not null default 0;

-- ----------------------------------------------------------------------------
-- 1. Subscriptions
-- ----------------------------------------------------------------------------
create table if not exists public.doctor_subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  doctor_id               uuid not null unique references public.profiles(id) on delete cascade,
  status                  text not null default 'trialing'
                            check (status in ('trialing','active','past_due','canceled','expired')),
  plan                    text not null default 'monthly'
                            check (plan in ('monthly','yearly')),
  price_usd               numeric(6,2) not null default 9.99,
  current_period_start    timestamptz not null default now(),
  current_period_end      timestamptz not null default (now() + interval '14 days'),
  trial_end               timestamptz,
  cancel_at_period_end    boolean not null default false,
  -- 'manual' covers Whish / OMT / bank transfer / cash activated by an admin.
  provider                text not null default 'manual',
  provider_customer_id    text,
  provider_subscription_id text,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists doctor_subscriptions_status_idx
  on public.doctor_subscriptions(status, current_period_end);

-- ----------------------------------------------------------------------------
-- 2. Payment ledger — every payment, however it arrived.
--    provider_event_id is UNIQUE: webhooks are retried, this makes them safe.
-- ----------------------------------------------------------------------------
create table if not exists public.subscription_payments (
  id                uuid primary key default gen_random_uuid(),
  doctor_id         uuid not null references public.profiles(id) on delete cascade,
  amount_usd        numeric(8,2) not null,
  currency          text not null default 'USD',
  method            text not null default 'manual'
                      check (method in ('manual','card','whish','omt','bank_transfer','cash','other')),
  reference         text,                    -- transfer ref / receipt number
  period_start      timestamptz,
  period_end        timestamptz,
  recorded_by       uuid references public.profiles(id),
  provider          text not null default 'manual',
  provider_event_id text unique,             -- idempotency key for webhooks
  created_at        timestamptz not null default now()
);

create index if not exists subscription_payments_doctor_idx
  on public.subscription_payments(doctor_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 3. The access rule, in one place.
--    past_due keeps working for 7 days (grace) so a failed card doesn't
--    instantly cut a doctor off mid-week.
-- ----------------------------------------------------------------------------
create or replace function public.doctor_has_access(d uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.doctor_subscriptions s
     where s.doctor_id = d
       and s.status in ('trialing','active','past_due')
       and s.current_period_end
           + (case when s.status = 'past_due' then interval '7 days' else interval '0 days' end)
           > now()
  )
$$;

grant execute on function public.doctor_has_access(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Patient-facing directory: unpaid doctors disappear everywhere at once
--    (doctor list, search, specialty filters, and chatbot recommendations).
-- ----------------------------------------------------------------------------
create or replace view public.public_doctors as
  select
    p.id,
    p.full_name,
    p.display_name,
    p.specialty,
    p.specialty_id,
    s.slug  as specialty_slug,
    s.name  as specialty_name,
    p.avatar_url,
    p.rating,
    p.review_count
  from public.profiles p
  left join public.specialties s on s.id = p.specialty_id
  where p.role = 'doctor'
    and p.is_active
    and exists (
      select 1
        from public.doctor_subscriptions ds
       where ds.doctor_id = p.id
         and ds.status in ('trialing','active','past_due')
         and ds.current_period_end
             + (case when ds.status = 'past_due' then interval '7 days' else interval '0 days' end)
             > now()
    );

grant select on public.public_doctors to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Every new doctor starts a 14-day trial automatically.
-- ----------------------------------------------------------------------------
create or replace function public.start_doctor_trial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'doctor' then
    insert into public.doctor_subscriptions
      (doctor_id, status, current_period_start, current_period_end, trial_end)
    values
      (new.id, 'trialing', now(), now() + interval '14 days', now() + interval '14 days')
    on conflict (doctor_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_start_doctor_trial on public.profiles;
create trigger profiles_start_doctor_trial
  after insert on public.profiles
  for each row execute function public.start_doctor_trial();

-- ----------------------------------------------------------------------------
-- 6. Existing doctors keep working (demo/seed accounts get a year).
-- ----------------------------------------------------------------------------
insert into public.doctor_subscriptions
  (doctor_id, status, current_period_start, current_period_end, provider, notes)
select p.id, 'active', now(), now() + interval '365 days', 'manual', 'Seeded before billing launch'
  from public.profiles p
 where p.role = 'doctor'
on conflict (doctor_id) do nothing;

-- ----------------------------------------------------------------------------
-- 7. Billing data is server-only: no anon/authenticated policies at all, so
--    only the service role (our API) can read or write it.
-- ----------------------------------------------------------------------------
alter table public.doctor_subscriptions   enable row level security;
alter table public.subscription_payments  enable row level security;

commit;
