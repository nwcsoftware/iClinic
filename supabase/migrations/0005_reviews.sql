-- ============================================================================
-- Migration 0005: Real patient reviews
--
--   1. doctor_reviews — one review per appointment (UNIQUE appointment_id), so
--      a rating can only ever come from a real visit that really happened
--   2. a trigger that recomputes profiles.rating / review_count from the
--      actual reviews, so the number shown to patients is never hand-set
--   3. clears the seeded demo ratings — from here the stars are earned
--
-- Safe to run multiple times. Requires 0004 (or 0002) for the rating columns;
-- they are re-added defensively so this file also stands alone.
-- ============================================================================

begin;

alter table public.profiles
  add column if not exists rating numeric(2,1)
    check (rating is null or (rating >= 0 and rating <= 5));
alter table public.profiles
  add column if not exists review_count integer not null default 0;

-- ----------------------------------------------------------------------------
-- 1. Reviews
-- ----------------------------------------------------------------------------
create table if not exists public.doctor_reviews (
  id             uuid primary key default gen_random_uuid(),
  doctor_id      uuid not null references public.profiles(id) on delete cascade,
  patient_id     uuid not null references public.patients(id) on delete cascade,
  -- One review per visit. This is what makes ratings trustworthy: no review
  -- can exist without an appointment, and no appointment can be rated twice.
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  rating         smallint not null check (rating between 1 and 5),
  comment        text check (comment is null or length(comment) <= 1000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists doctor_reviews_doctor_idx
  on public.doctor_reviews(doctor_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 2. Aggregates are derived, never set by hand.
-- ----------------------------------------------------------------------------
create or replace function public.refresh_doctor_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d uuid := coalesce(new.doctor_id, old.doctor_id);
begin
  update public.profiles p
     set rating       = agg.avg_rating,
         review_count = agg.cnt
    from (
      select round(avg(rating)::numeric, 1) as avg_rating,
             count(*)                       as cnt
        from public.doctor_reviews
       where doctor_id = d
    ) agg
   where p.id = d;
  return coalesce(new, old);
end;
$$;

drop trigger if exists doctor_reviews_refresh on public.doctor_reviews;
create trigger doctor_reviews_refresh
  after insert or update or delete on public.doctor_reviews
  for each row execute function public.refresh_doctor_rating();

-- ----------------------------------------------------------------------------
-- 3. Drop the seeded demo ratings — every star from now on is earned.
-- ----------------------------------------------------------------------------
update public.profiles
   set rating = null, review_count = 0
 where role = 'doctor'
   and not exists (select 1 from public.doctor_reviews r where r.doctor_id = profiles.id);

-- ----------------------------------------------------------------------------
-- 4. Reviews are public to read; writing goes through the API (service role),
--    which is what verifies the patient actually attended the appointment.
-- ----------------------------------------------------------------------------
alter table public.doctor_reviews enable row level security;

drop policy if exists doctor_reviews_public_read on public.doctor_reviews;
create policy doctor_reviews_public_read on public.doctor_reviews
  for select to anon, authenticated using (true);

commit;
