-- ============================================================================
-- Migration 0009: Doctor workplaces, the Lebanon healthcare map, surgical
-- history, and consultation records.
--
--   1. healthcare_locations  — one row per real hospital/clinic. SHARED: when
--      five doctors work at Saint George, there is still one row and one map
--      marker. A normalised unique key is what enforces that.
--   2. doctor_locations      — which doctors work where, on which days, at what
--      hours. A doctor may have several.
--   3. doctor_availability   — gains location_id, so a bookable slot knows
--      which building the patient should walk into.
--   4. appointments          — gains location_id + consultation fields, rather
--      than a parallel table, so history is the appointment record itself.
--   5. patient_surgeries     — replaces the single free-text medical note with
--      structured, repeatable entries.
--
-- Additive and safe to run more than once.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. The places care happens. Public to read: this is the map.
-- ----------------------------------------------------------------------------
create table if not exists public.healthcare_locations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  type         text not null default 'clinic'
                 check (type in ('hospital','clinic','private_clinic','medical_center')),
  address      text,
  city         text,
  governorate  text,
  latitude     numeric(9,6),
  longitude    numeric(9,6),
  phone        text,
  -- Set once a human has confirmed the pin sits on the right building.
  is_verified  boolean not null default false,
  -- Seeded reference data vs. something a doctor typed in.
  is_seed      boolean not null default false,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint healthcare_locations_lat_ck
    check (latitude  is null or (latitude  between -90  and 90)),
  constraint healthcare_locations_lng_ck
    check (longitude is null or (longitude between -180 and 180))
);

-- Deduplication. Two doctors adding "Saint George Hospital" in Beirut must land
-- on the same row, so casing, spacing and punctuation are normalised away.
create or replace function public.normalise_location_key(p_name text, p_city text)
returns text
language sql
immutable
as $fn$
  select lower(regexp_replace(coalesce(p_name, ''), '[^a-zA-Z0-9]+', '', 'g'))
      || '|'
      || lower(regexp_replace(coalesce(p_city, ''), '[^a-zA-Z0-9]+', '', 'g'))
$fn$;

create unique index if not exists healthcare_locations_dedupe_idx
  on public.healthcare_locations (public.normalise_location_key(name, city));

-- The map queries by bounding box, then filters by type.
create index if not exists healthcare_locations_geo_idx
  on public.healthcare_locations (latitude, longitude)
  where latitude is not null and longitude is not null;
create index if not exists healthcare_locations_type_idx on public.healthcare_locations (type);
create index if not exists healthcare_locations_city_idx on public.healthcare_locations (city);

-- ----------------------------------------------------------------------------
-- 2. Which doctor works where, and when.
--    working_days is 0-6 (Sunday = 0) to match doctor_availability.weekday.
--    working_hours is {"1":{"start":"09:00","end":"17:00"}, ...}.
-- ----------------------------------------------------------------------------
create table if not exists public.doctor_locations (
  id                   uuid primary key default gen_random_uuid(),
  doctor_id            uuid not null references public.profiles(id) on delete cascade,
  location_id          uuid not null references public.healthcare_locations(id) on delete cascade,
  working_days         smallint[] not null default '{}',
  working_hours        jsonb not null default '{}'::jsonb,
  appointment_duration smallint,
  phone_number         text,
  notes                text,
  is_primary           boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (doctor_id, location_id),
  constraint doctor_locations_duration_ck
    check (appointment_duration is null or appointment_duration between 5 and 240)
);

create index if not exists doctor_locations_doctor_idx   on public.doctor_locations (doctor_id);
create index if not exists doctor_locations_location_idx on public.doctor_locations (location_id);

-- ----------------------------------------------------------------------------
-- 3. A bookable slot belongs to a place. Null means "wherever the doctor
--    normally is", so existing availability keeps working untouched.
-- ----------------------------------------------------------------------------
alter table public.doctor_availability
  add column if not exists location_id uuid references public.healthcare_locations(id) on delete set null;

create index if not exists doctor_availability_location_idx on public.doctor_availability (location_id);

-- ----------------------------------------------------------------------------
-- 4. The visit record. Consultation notes live on the appointment rather than
--    in a parallel table, so there is exactly one row per visit and the history
--    is simply the appointment list.
-- ----------------------------------------------------------------------------
alter table public.appointments
  add column if not exists location_id  uuid references public.healthcare_locations(id) on delete set null,
  add column if not exists diagnosis    text,
  add column if not exists treatment    text,
  add column if not exists doctor_notes text,
  add column if not exists follow_up    text;

create index if not exists appointments_location_idx on public.appointments (location_id);
create index if not exists appointments_patient_doctor_idx
  on public.appointments (patient_id, doctor_id, appointment_date desc);

-- ----------------------------------------------------------------------------
-- 5. Surgical history — structured and repeatable, replacing one free-text box.
-- ----------------------------------------------------------------------------
create table if not exists public.patient_surgeries (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null references public.patients(id) on delete cascade,
  procedure_name     text not null,
  surgery_date       date,
  hospital_or_clinic text,
  surgeon_name       text,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists patient_surgeries_patient_idx
  on public.patient_surgeries (patient_id, surgery_date desc nulls last);

-- ----------------------------------------------------------------------------
-- 6. Row level security.
--    The map is public. Everything doctor- or patient-owned is written through
--    the API on the service role, so no permissive write policies are granted.
-- ----------------------------------------------------------------------------
alter table public.healthcare_locations enable row level security;
alter table public.doctor_locations     enable row level security;
alter table public.patient_surgeries    enable row level security;

drop policy if exists healthcare_locations_public_read on public.healthcare_locations;
create policy healthcare_locations_public_read on public.healthcare_locations
  for select using (true);

-- Where a doctor works is public too: patients need it before booking.
drop policy if exists doctor_locations_public_read on public.doctor_locations;
create policy doctor_locations_public_read on public.doctor_locations
  for select using (true);

-- A patient may read their own surgeries. Writes go through the API.
-- current_patient_ids() is the SECURITY DEFINER helper from migration 0003.
drop policy if exists patient_surgeries_self_select on public.patient_surgeries;
create policy patient_surgeries_self_select on public.patient_surgeries
  for select using (patient_id in (select public.current_patient_ids()));

grant select on public.healthcare_locations to anon, authenticated;
grant select on public.doctor_locations     to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. Seed data so the map has something on it immediately.
--    Coordinates are APPROXIMATE and left unverified — good enough to drop a
--    pin in the right neighbourhood, not surveyed. is_seed marks them so they
--    can be corrected or removed without touching doctor-created rows.
-- ----------------------------------------------------------------------------
insert into public.healthcare_locations
  (name, type, address, city, governorate, latitude, longitude, is_seed)
values
  ('American University of Beirut Medical Center','hospital','Cairo Street, Hamra','Beirut','Beirut',33.896900,35.482000,true),
  ('Hotel-Dieu de France','hospital','Boulevard Alfred Naccache, Achrafieh','Beirut','Beirut',33.882300,35.518300,true),
  ('Saint George Hospital University Medical Center','hospital','Youssef Sursock Street, Achrafieh','Beirut','Beirut',33.893800,35.514700,true),
  ('Clemenceau Medical Center','hospital','Clemenceau Street','Beirut','Beirut',33.892500,35.484100,true),
  ('Rafik Hariri University Hospital','hospital','Bir Hassan, Jnah','Beirut','Beirut',33.863100,35.493900,true),
  ('Mount Lebanon Hospital','hospital','Hazmieh Main Road','Hazmieh','Mount Lebanon',33.847800,35.539500,true),
  ('Bellevue Medical Center','hospital','Mansourieh Main Road','Mansourieh','Mount Lebanon',33.861700,35.575000,true),
  ('Centre Hospitalier du Nord','hospital','Zgharta Road','Zgharta','North',34.398000,35.895000,true),
  ('Nini Hospital','hospital','Abou Samra','Tripoli','North',34.436700,35.849700,true),
  ('Hammoud Hospital University Medical Center','hospital','Ghazieh Road','Saida','South',33.560600,35.376000,true),
  ('Notre Dame de Secours University Hospital','hospital','Byblos','Jbeil','Mount Lebanon',34.123000,35.651000,true),
  ('Bekaa Hospital','hospital','Zahle Main Road','Zahle','Bekaa',33.846000,35.902000,true)
on conflict do nothing;

commit;
