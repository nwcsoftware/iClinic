-- ============================================================================
-- Migration 0011: Secretaries (the receptionist role, scoped to locations)
--
-- "Secretary" and "receptionist" are the same job. The role already exists as
-- `receptionist`, with a doctor-assignment table and pages that use it, so
-- this builds on that rather than adding a second role meaning the same thing.
-- The word in the interface is Secretary; the value in the database stays
-- `receptionist` so nothing already relying on it breaks.
--
-- What changes is the shape of the permission. Until now a receptionist was
-- attached to a doctor and could see everything that doctor had. Now the grant
-- is per doctor AND per workplace:
--
--   * A doctor with three workplaces grants the ones they name. There is no
--     "all locations" state, so a workplace added later starts invisible until
--     the doctor says otherwise.
--
--   * Medical columns are not merely hidden. The view below has no reason, no
--     notes, no diagnosis, no treatment, no doctor notes and no follow-up in
--     its projection, so no query written against it can return one.
--
-- Additive. Safe to run more than once. Requires 0009 (doctor_locations).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. One missing appointment status
--
--    The enum already carries scheduled, in_progress, completed, cancelled and
--    no_show. `no_show` is precisely the "not completed" case — the patient did
--    not come — so only "confirmed" is genuinely missing, and adding a second
--    value meaning what no_show already means would only create ambiguity.
--
--    Deliberately outside the transaction below: Postgres will not let a new
--    enum value be used in the transaction that added it.
-- ----------------------------------------------------------------------------
alter type appointment_status add value if not exists 'confirmed' after 'scheduled';

begin;

-- ----------------------------------------------------------------------------
-- 2. The doctor link, extended
--
--    receptionist_doctor_assignments already exists with id, receptionist_id,
--    doctor_id, is_active and created_at. It only needs to record who created
--    the row, for the doctor's own activity view.
-- ----------------------------------------------------------------------------
alter table public.receptionist_doctor_assignments
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

create index if not exists rda_doctor_idx
  on public.receptionist_doctor_assignments(doctor_id);
create index if not exists rda_receptionist_idx
  on public.receptionist_doctor_assignments(receptionist_id);

-- One person, one row per doctor. Without this a secretary could be attached
-- twice and quietly consume two of the doctor's three slots.
create unique index if not exists rda_unique_pair
  on public.receptionist_doctor_assignments(doctor_id, receptionist_id);

-- Three secretaries per doctor, enforced here so it holds for any insert
-- rather than only the one the API makes. Deactivating does not free a slot;
-- removing the assignment does, which is the difference between "not right
-- now" and "no longer works here".
create or replace function public.enforce_secretary_limit()
returns trigger language plpgsql as $$
declare
  existing int;
begin
  select count(*) into existing
    from public.receptionist_doctor_assignments
   where doctor_id = new.doctor_id
     and (tg_op = 'INSERT' or id <> new.id);
  if existing >= 3 then
    raise exception 'A doctor can have at most 3 secretaries'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists rda_limit on public.receptionist_doctor_assignments;
create trigger rda_limit
  before insert or update of doctor_id on public.receptionist_doctor_assignments
  for each row execute function public.enforce_secretary_limit();

-- ----------------------------------------------------------------------------
-- 3. Which of that doctor's workplaces the secretary may touch
-- ----------------------------------------------------------------------------
create table if not exists public.receptionist_location_grants (
  id                  uuid primary key default gen_random_uuid(),
  assignment_id       uuid not null references public.receptionist_doctor_assignments(id) on delete cascade,
  doctor_location_id  uuid not null references public.doctor_locations(id) on delete cascade,
  created_at          timestamptz not null default now(),
  unique (assignment_id, doctor_location_id)
);

create index if not exists rlg_assignment_idx on public.receptionist_location_grants(assignment_id);
create index if not exists rlg_location_idx   on public.receptionist_location_grants(doctor_location_id);

-- A grant must name a workplace belonging to the doctor doing the granting.
-- This is the one mistake the table exists to prevent, so it is refused by the
-- database rather than trusted to callers.
create or replace function public.enforce_secretary_location_owner()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1
      from public.receptionist_doctor_assignments a
      join public.doctor_locations dl on dl.id = new.doctor_location_id
     where a.id = new.assignment_id
       and dl.doctor_id = a.doctor_id
  ) then
    raise exception 'That location does not belong to this doctor'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists rlg_owner_check on public.receptionist_location_grants;
create trigger rlg_owner_check
  before insert or update on public.receptionist_location_grants
  for each row execute function public.enforce_secretary_location_owner();

-- ----------------------------------------------------------------------------
-- 4. Authorisation helpers
--
--    SECURITY DEFINER so the API and RLS give the same answer. Both return
--    false rather than raising: an unauthorised request should see nothing,
--    not an error describing what exists.
-- ----------------------------------------------------------------------------
create or replace function public.secretary_works_for(p_secretary uuid, p_doctor uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.receptionist_doctor_assignments
     where receptionist_id = p_secretary
       and doctor_id       = p_doctor
       and is_active
  );
$$;

create or replace function public.secretary_may_use_location(
  p_secretary uuid, p_doctor uuid, p_location uuid
) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.receptionist_doctor_assignments a
      join public.receptionist_location_grants g on g.assignment_id = a.id
      join public.doctor_locations dl on dl.id = g.doctor_location_id
     where a.receptionist_id = p_secretary
       and a.doctor_id       = p_doctor
       and a.is_active
       and dl.location_id    = p_location
  );
$$;

-- ----------------------------------------------------------------------------
-- 5. What a secretary may read of an appointment
--
--    A view, not a convention. Every medical column is absent from the
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
--    A secretary acts on a doctor''s behalf, so the doctor can see what was
--    done. Administrative actions only, because there is nothing medical they
--    are able to do.
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

-- ----------------------------------------------------------------------------
-- 7. Row level security
--
--    The API uses the service role and checks for itself; these cover anything
--    reaching the tables with a user token.
-- ----------------------------------------------------------------------------
alter table public.receptionist_location_grants enable row level security;
alter table public.secretary_audit_log          enable row level security;

drop policy if exists doctor_manages_own_grants on public.receptionist_location_grants;
create policy doctor_manages_own_grants on public.receptionist_location_grants
  for all using (
    exists (select 1 from public.receptionist_doctor_assignments a
             where a.id = assignment_id and a.doctor_id = auth.uid())
  ) with check (
    exists (select 1 from public.receptionist_doctor_assignments a
             where a.id = assignment_id and a.doctor_id = auth.uid())
  );

drop policy if exists secretary_reads_own_grants on public.receptionist_location_grants;
create policy secretary_reads_own_grants on public.receptionist_location_grants
  for select using (
    exists (select 1 from public.receptionist_doctor_assignments a
             where a.id = assignment_id and a.receptionist_id = auth.uid())
  );

drop policy if exists doctor_reads_own_audit on public.secretary_audit_log;
create policy doctor_reads_own_audit on public.secretary_audit_log
  for select using (doctor_id = auth.uid());

commit;
