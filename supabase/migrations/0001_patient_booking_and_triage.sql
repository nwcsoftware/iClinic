-- ============================================================================
-- Migration 0001: Patient self-service booking + AI triage foundation
-- ----------------------------------------------------------------------------
-- Adds the schema the patient mobile app needs:
--   1. Link patient records to Supabase auth users        (patients.user_id)
--   2. A clinic specialty catalog + doctor mapping        (specialties, profiles.specialty_id)
--   3. Doctor weekly availability + time-off               (doctor_availability, doctor_time_off)
--   4. Patient self-booking support on appointments        (booking_source, nullable created_by)
--   5. AI triage chatbot storage                           (triage_sessions, triage_messages)
--   6. A safe public doctor directory view                 (public_doctors)
--   7. Row Level Security policies so patients (auth users) can:
--        - read the doctor directory + availability
--        - read/update their own patient record
--        - read their own appointments + pricing
--        - read/write their own triage sessions
--
-- Safe to run multiple times (idempotent). Existing staff/web behaviour is
-- untouched: all new policies are ADDITIVE (Postgres combines policies with OR).
-- weekday convention: 0 = Sunday ... 6 = Saturday (matches JS Date.getDay()).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Link patients to auth users
-- ----------------------------------------------------------------------------
alter table public.patients
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists patients_user_id_key
  on public.patients(user_id) where user_id is not null;

-- ----------------------------------------------------------------------------
-- 2. Specialty catalog + doctor mapping
-- ----------------------------------------------------------------------------
create table if not exists public.specialties (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,                       -- helps the AI map symptoms -> specialty
  sort_order  int  default 0,
  is_active   boolean default true,
  created_at  timestamptz default now()
);

insert into public.specialties (slug, name, description) values
  ('general_practice',   'General Practitioner',  'General health concerns, check-ups, common illnesses, first point of contact.'),
  ('family_medicine',    'Family Medicine',       'Primary care for all ages, ongoing and preventive care.'),
  ('internal_medicine',  'Internal Medicine',     'Adult internal organs and complex/chronic conditions.'),
  ('dermatology',        'Dermatology',           'Skin, hair and nails: rashes, acne, moles, eczema, infections.'),
  ('cardiology',         'Cardiology',            'Heart and blood vessels: chest pain, palpitations, blood pressure.'),
  ('pediatrics',         'Pediatrics',            'Health of infants, children and adolescents.'),
  ('orthopedics',        'Orthopedics',           'Bones, joints, muscles, ligaments: fractures, back/knee pain, sports injuries.'),
  ('gynecology',         'Gynecology & Obstetrics','Female reproductive health, pregnancy, menstrual issues.'),
  ('otolaryngology',     'ENT (Ear, Nose & Throat)','Ear, nose, throat, sinus, hearing and balance problems.'),
  ('ophthalmology',      'Ophthalmology',         'Eyes and vision: pain, blurred vision, infections.'),
  ('psychiatry',         'Psychiatry',            'Mental health: anxiety, depression, sleep, mood.'),
  ('dentistry',          'Dentistry',             'Teeth and gums: pain, cavities, cleaning.'),
  ('neurology',          'Neurology',             'Brain and nerves: headaches, migraines, numbness, dizziness, seizures.'),
  ('gastroenterology',   'Gastroenterology',      'Digestive system: stomach pain, reflux, bowel issues.'),
  ('endocrinology',      'Endocrinology',         'Hormones and metabolism: diabetes, thyroid, weight.'),
  ('urology',            'Urology',               'Urinary tract and male reproductive system.'),
  ('pulmonology',        'Pulmonology',           'Lungs and breathing: cough, asthma, shortness of breath.'),
  ('rheumatology',       'Rheumatology',          'Joints, autoimmune and inflammatory conditions.'),
  ('nephrology',         'Nephrology',            'Kidney conditions.'),
  ('allergy_immunology', 'Allergy & Immunology',  'Allergies, asthma, immune-system problems.')
on conflict (slug) do nothing;

-- Map doctor profiles to a catalog specialty (keeps existing free-text `specialty` for display).
alter table public.profiles
  add column if not exists specialty_id uuid references public.specialties(id);

-- Backfill existing doctors by matching their free-text specialty to a catalog name (case-insensitive).
update public.profiles p
   set specialty_id = s.id
  from public.specialties s
 where p.specialty_id is null
   and p.specialty is not null
   and lower(trim(p.specialty)) = lower(s.name);

-- ----------------------------------------------------------------------------
-- 3. Doctor availability (recurring weekly) + time-off (date blackouts)
-- ----------------------------------------------------------------------------
create table if not exists public.doctor_availability (
  id           uuid primary key default gen_random_uuid(),
  doctor_id    uuid not null references public.profiles(id) on delete cascade,
  weekday      smallint not null check (weekday between 0 and 6),  -- 0=Sun .. 6=Sat
  start_time   time not null,
  end_time     time not null,
  slot_minutes int  not null default 30 check (slot_minutes between 5 and 240),
  is_active    boolean default true,
  created_at   timestamptz default now(),
  check (end_time > start_time)
);
create index if not exists doctor_availability_doctor_idx
  on public.doctor_availability(doctor_id, weekday) where is_active;

create table if not exists public.doctor_time_off (
  id         uuid primary key default gen_random_uuid(),
  doctor_id  uuid not null references public.profiles(id) on delete cascade,
  off_date   date not null,
  reason     text,
  created_at timestamptz default now(),
  unique (doctor_id, off_date)
);

-- ----------------------------------------------------------------------------
-- 4. Appointment self-booking support
-- ----------------------------------------------------------------------------
alter table public.appointments
  add column if not exists booking_source text not null default 'staff'
    check (booking_source in ('staff','patient_app'));

-- Patient-booked appointments have no staff creator.
alter table public.appointments
  alter column created_by drop not null;

-- ----------------------------------------------------------------------------
-- 5. AI triage chatbot storage
-- ----------------------------------------------------------------------------
create table if not exists public.triage_sessions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid references auth.users(id) on delete set null,
  patient_id                uuid references public.patients(id) on delete set null,
  status                    text not null default 'active'
                              check (status in ('active','completed','abandoned')),
  recommended_specialty_id  uuid references public.specialties(id),
  recommended_specialty_text text,
  urgency                   text check (urgency in ('routine','soon','urgent','emergency')),
  summary                   text,        -- short summary of the patient's situation for the doctor
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);
create index if not exists triage_sessions_user_idx on public.triage_sessions(user_id);

create table if not exists public.triage_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.triage_sessions(id) on delete cascade,
  role       text not null check (role in ('user','assistant','system')),
  content    text not null,
  created_at timestamptz default now()
);
create index if not exists triage_messages_session_idx on public.triage_messages(session_id, created_at);

-- ----------------------------------------------------------------------------
-- 6. Safe public doctor directory (only non-sensitive columns)
--    Runs with the view owner's privileges, so it exposes ONLY these columns
--    without opening up the full profiles table.
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
    p.avatar_url
  from public.profiles p
  left join public.specialties s on s.id = p.specialty_id
  where p.role = 'doctor' and p.is_active;

grant select on public.public_doctors to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. Row Level Security for patient-facing tables
-- ----------------------------------------------------------------------------
alter table public.specialties           enable row level security;
alter table public.doctor_availability   enable row level security;
alter table public.doctor_time_off       enable row level security;
alter table public.triage_sessions       enable row level security;
alter table public.triage_messages       enable row level security;

-- Specialties: readable by any authenticated user (and anon, for the pre-login directory).
drop policy if exists specialties_read on public.specialties;
create policy specialties_read on public.specialties
  for select to anon, authenticated using (is_active);

-- Doctor availability / time-off: readable by authenticated patients (not sensitive).
drop policy if exists availability_read on public.doctor_availability;
create policy availability_read on public.doctor_availability
  for select to authenticated using (is_active);

drop policy if exists timeoff_read on public.doctor_time_off;
create policy timeoff_read on public.doctor_time_off
  for select to authenticated using (true);

-- Patients: a user can see/update the patient record linked to their auth uid.
-- (ADDITIVE — existing staff policies on patients remain in force via OR.)
drop policy if exists patients_self_select on public.patients;
create policy patients_self_select on public.patients
  for select to authenticated using (user_id = auth.uid());

drop policy if exists patients_self_update on public.patients;
create policy patients_self_update on public.patients
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- A signed-in user may claim/create their own patient record (self-registration).
drop policy if exists patients_self_insert on public.patients;
create policy patients_self_insert on public.patients
  for insert to authenticated with check (user_id = auth.uid());

-- Appointments: a patient can read appointments tied to their own patient record.
-- (Booking itself is done server-side with the service role so slot conflicts can
--  be validated — no broad patient INSERT policy on purpose.)
drop policy if exists appointments_self_select on public.appointments;
create policy appointments_self_select on public.appointments
  for select to authenticated using (
    patient_id in (select id from public.patients where user_id = auth.uid())
  );

-- Pricing for the patient's own appointments.
alter table public.appointment_pricing enable row level security;
drop policy if exists pricing_self_select on public.appointment_pricing;
create policy pricing_self_select on public.appointment_pricing
  for select to authenticated using (
    appointment_id in (
      select a.id from public.appointments a
      join public.patients pt on pt.id = a.patient_id
      where pt.user_id = auth.uid()
    )
  );

-- Triage: a user owns their own sessions and messages.
drop policy if exists triage_sessions_own on public.triage_sessions;
create policy triage_sessions_own on public.triage_sessions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists triage_messages_own on public.triage_messages;
create policy triage_messages_own on public.triage_messages
  for all to authenticated
  using (session_id in (select id from public.triage_sessions where user_id = auth.uid()))
  with check (session_id in (select id from public.triage_sessions where user_id = auth.uid()));

commit;

-- ============================================================================
-- NOTE: `appointment_pricing` had RLS enabled above. If your staff/web client
-- reads pricing with the ANON key (not the service role), confirm staff SELECT
-- policies still exist on that table. The web API routes use the service-role
-- admin client, which bypasses RLS, so server routes are unaffected.
-- ============================================================================
