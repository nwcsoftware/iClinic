-- ============================================================================
-- Migration 0011: Secretaries
--
-- A secretary is staff a doctor creates to run the administrative side of
-- their practice: schedules, availability and whether someone turned up. They
-- must never see why a patient is coming, what was diagnosed, or what was
-- prescribed.
--
-- Two things make that safe rather than merely tidy:
--
--   1. Access is scoped to a doctor AND a location, never to a doctor alone.
--      A secretary at the Tuesday clinic has no business seeing the Monday
--      hospital list, so the grant is per doctor_locations row.
--
--   2. The medical columns are never selected for a secretary. Hiding them in
--      the UI would leave them in the API response, which is not privacy, it
--      is decoration.
--
-- The existing `receptionist` role is left exactly as it was. It is a
-- different, doctor-wide role that predates this and still has its own tables
-- and pages; nothing here touches it.
--
-- Additive and safe to run more than once. Requires 0009 (doctor_locations).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Appointment statuses a secretary can set
--
--    'confirmed' and 'not_completed' are administrative: the patient is coming,
--    or the patient did not turn up. Neither says anything medical, which is
--    exactly why a secretary is allowed to set them.
-- ----------------------------------------------------------------------------
do $$
declare
  con text;
begin
  select conname into con
    from pg_constraint
   where conrelid = 'public.appointments'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%status%';
  if con is not null then
    execute format('alter table public.appointments drop constraint %I', con);
  end if;
end $$;

alter table public.appointments
  add constraint appointments_status_ck
  check (status in ('scheduled', 'confirmed', 'completed', 'not_completed', 'cancelled'));

-- ----------------------------------------------------------------------------
-- 2. Which doctors a secretary works for
--
--    The secretary is a profiles row like any other staff member, so one person
--    has one login no matter how many doctors they work for. Removing them from
--    one doctor deletes this row only; their account and their other doctors
--    are untouched.
-- ----------------------------------------------------------------------------
create table if not exists public.doctor_secretaries (
  id            uuid primary key default gen_random_uuid(),
  doctor_id     uuid not null references public.profiles(id) on delete cascade,
  secretary_id  uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'active' check (status in ('active', 'inactive')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id) on delete set null,
  unique (doctor_id, secretary_id)
);

create index if not exists doctor_secretaries_doctor_idx    on public.doctor_secretaries(doctor_id);
create index if not exists doctor_secretaries_secretary_idx on public.doctor_secretaries(secretary_id);

-- A doctor may have three secretaries. Counted here rather than in the API so
-- a fourth cannot be created by any route, including a direct insert.
-- Deactivating does not free a slot; removing the relationship does, which is
-- the distinction between "not right now" and "no longer works here".
create or replace function public.enforce_secretary_limit()
returns trigger language plpgsql as $$
declare
  existing int;
begin
  select count(*) into existing
    from public.doctor_secretaries
   where doctor_id = new.doctor_id
     and (tg_op = 'INSERT' or id <> new.id);
  if existing >= 3 then
    raise exception 'A doctor can have at most 3 secretaries'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists doctor_secretaries_limit on public.doctor_secretaries;
create trigger doctor_secretaries_limit
  before insert or update of doctor_id on public.doctor_secretaries
  for each row execute function public.enforce_secretary_limit();

-- ----------------------------------------------------------------------------
-- 3. Which of that doctor's locations the secretary may touch
--
--    Never implied. A doctor with three workplaces who grants one grants one:
--    there is no "all locations" state, so a new workplace added later starts
--    invisible to every secretary until the doctor says otherwise.
-- ----------------------------------------------------------------------------
create table if not exists public.doctor_secretary_locations (
  id                   uuid primary key default gen_random_uuid(),
  doctor_secretary_id  uuid not null references public.doctor_secretaries(id) on delete cascade,
  doctor_location_id   uuid not null references public.doctor_locations(id) on delete cascade,
  created_at           timestamptz not null default now(),
  unique (doctor_secretary_id, doctor_location_id)
);

create index if not exists dsl_secretary_idx on public.doctor_secretary_locations(doctor_secretary_id);
create index if not exists dsl_location_idx  on public.doctor_secretary_locations(doctor_location_id);

-- A grant must name a workplace that belongs to the doctor doing the granting.
-- Without this, a malformed insert could hand a secretary a different doctor's
-- clinic, which is the one mistake this table exists to prevent.
create or replace function public.enforce_secretary_location_owner()
returns trigger language plpgsql as $$
declare
  ok boolean;
begin
  select exists (
    select 1
      from public.doctor_secretaries ds
      join public.doctor_locations dl on dl.id = new.doctor_location_id
     where ds.id = new.doctor_secretary_id
       and dl.doctor_id = ds.doctor_id
  ) into ok;
  if not ok then
    raise exception 'That location does not belong to this doctor'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists dsl_owner_check on public.doctor_secretary_locations;
create trigger dsl_owner_check
  before insert or update on public.doctor_secretary_locations
  for each row execute function public.enforce_secretary_location_owner();

-- ----------------------------------------------------------------------------
-- 4. Authorisation helpers
--
--    SECURITY DEFINER so they can read the join tables without every caller
--    needing their own policy on them, and so the same answer is given to the
--    API and to RLS. Both return false rather than raising: an unauthorised
--    request should see nothing, not an error describing what exists.
-- ----------------------------------------------------------------------------
create or replace function public.secretary_works_for(p_secretary uuid, p_doctor uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.doctor_secretaries
     where secretary_id = p_secretary
       and doctor_id    = p_doctor
       and status       = 'active'
  );
$$;

-- True only when the doctor has granted this exact workplace.
create or replace function public.secretary_may_use_location(
  p_secretary uuid, p_doctor uuid, p_location uuid
) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.doctor_secretaries ds
      join public.doctor_secretary_locations dsl on dsl.doctor_secretary_id = ds.id
      join public.doctor_locations dl on dl.id = dsl.doctor_location_id
     where ds.secretary_id = p_secretary
       and ds.doctor_id    = p_doctor
       and ds.status       = 'active'
       and dl.location_id  = p_location
  );
$$;

-- ----------------------------------------------------------------------------
-- 5. What a secretary is allowed to read of an appointment
--
--    A view rather than a convention. Every medical column is absent from the
--    projection, so there is no query a secretary can write, and no bug an API
--    can have, that returns a diagnosis or a reason for visit through it.
-- ----------------------------------------------------------------------------
create or replace view public.secretary_appointments as
  select
    a.id,
    a.doctor_id,
    a.location_id,
    a.appointment_date,
    a.start_time,
    a.end_time,
    a.status,
    a.created_at,
    a.updated_at,
    p.id            as patient_id,
    p.full_name     as patient_name,
    p.mobile_number as patient_phone,
    p.blood_type    as patient_blood_type
  from public.appointments a
  join public.patients p on p.id = a.patient_id;

comment on view public.secretary_appointments is
  'Administrative view of an appointment. Deliberately omits reason, notes, diagnosis, treatment, doctor_notes and follow_up, and every patient medical field except blood type.';

-- ----------------------------------------------------------------------------
-- 6. Audit log
--
--    A secretary acts on a doctor''s behalf, so the doctor should be able to
--    see what was done. Records the administrative action only; there is
--    nothing medical to record because there is nothing medical they can do.
-- ----------------------------------------------------------------------------
create table if not exists public.secretary_audit_log (
  id           uuid primary key default gen_random_uuid(),
  secretary_id uuid references public.profiles(id) on delete set null,
  doctor_id    uuid references public.profiles(id) on delete cascade,
  action       text not null,
  entity       text,
  entity_id    uuid,
  detail       jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists secretary_audit_doctor_idx
  on public.secretary_audit_log(doctor_id, created_at desc);
create index if not exists secretary_audit_secretary_idx
  on public.secretary_audit_log(secretary_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 7. Row level security
--
--    The API uses the service role and does its own checking, so these
--    policies exist for anything that reaches the tables with a user token.
--    A doctor sees their own rows; a secretary sees the rows naming them.
-- ----------------------------------------------------------------------------
alter table public.doctor_secretaries         enable row level security;
alter table public.doctor_secretary_locations enable row level security;
alter table public.secretary_audit_log        enable row level security;

drop policy if exists doctor_manages_own_secretaries on public.doctor_secretaries;
create policy doctor_manages_own_secretaries on public.doctor_secretaries
  for all using (doctor_id = auth.uid()) with check (doctor_id = auth.uid());

drop policy if exists secretary_reads_own_links on public.doctor_secretaries;
create policy secretary_reads_own_links on public.doctor_secretaries
  for select using (secretary_id = auth.uid());

drop policy if exists doctor_manages_own_grants on public.doctor_secretary_locations;
create policy doctor_manages_own_grants on public.doctor_secretary_locations
  for all using (
    exists (select 1 from public.doctor_secretaries ds
             where ds.id = doctor_secretary_id and ds.doctor_id = auth.uid())
  ) with check (
    exists (select 1 from public.doctor_secretaries ds
             where ds.id = doctor_secretary_id and ds.doctor_id = auth.uid())
  );

drop policy if exists secretary_reads_own_grants on public.doctor_secretary_locations;
create policy secretary_reads_own_grants on public.doctor_secretary_locations
  for select using (
    exists (select 1 from public.doctor_secretaries ds
             where ds.id = doctor_secretary_id and ds.secretary_id = auth.uid())
  );

drop policy if exists doctor_reads_own_audit on public.secretary_audit_log;
create policy doctor_reads_own_audit on public.secretary_audit_log
  for select using (doctor_id = auth.uid());

commit;
