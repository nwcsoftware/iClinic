-- ============================================================================
-- Migration 0008: Patient medical profile + structured prescriptions
--
--   1. patients            — allergies, chronic conditions, blood type, notes
--   2. prescription_items  — times_of_day, so "3 times a day" can also say
--                            WHICH hours, which is what a patient actually
--                            needs to follow the instruction
--   3. helpful indexes for the doctor's patient-detail and the patient's
--      medications screen
--
-- Allergies and chronic conditions are arrays of short free-text labels. They
-- are deliberately NOT a fixed catalogue: patients type what they know, and a
-- doctor reads it as context, never as a machine-checked contraindication.
--
-- Additive and safe to run more than once.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Medical profile on the patient record
-- ----------------------------------------------------------------------------
alter table public.patients
  add column if not exists allergies          text[] not null default '{}',
  add column if not exists chronic_conditions text[] not null default '{}',
  add column if not exists blood_type         text,
  add column if not exists medical_notes      text,
  -- Set the first time the patient reviews this section, so the app can stop
  -- nagging someone who genuinely has nothing to declare.
  add column if not exists medical_reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'patients_blood_type_ck'
  ) then
    alter table public.patients
      add constraint patients_blood_type_ck
      check (blood_type is null or blood_type in
        ('A+','A-','B+','B-','AB+','AB-','O+','O-'));
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. When to take it, not just how often.
--    Stored as text so '08:00' and 'after lunch' are both expressible.
-- ----------------------------------------------------------------------------
alter table public.prescription_items
  add column if not exists times_of_day text[] not null default '{}',
  -- Computed on the server when the prescription is written, so the patient
  -- app can show "active" vs "finished" without parsing "for 7 days".
  add column if not exists starts_on date,
  add column if not exists ends_on   date;

-- ----------------------------------------------------------------------------
-- 3. Indexes for the two new read paths
-- ----------------------------------------------------------------------------
create index if not exists prescriptions_patient_idx
  on public.prescriptions(patient_id, created_at desc);

create index if not exists prescriptions_doctor_idx
  on public.prescriptions(doctor_id, created_at desc);

create index if not exists prescriptions_appointment_idx
  on public.prescriptions(appointment_id);

create index if not exists prescription_items_rx_idx
  on public.prescription_items(prescription_id, sort_order);

-- ----------------------------------------------------------------------------
-- 4. Patients may read their own prescriptions. Writing is server-only:
--    a prescription can only be created by a doctor through the API.
--    current_patient_ids() is the SECURITY DEFINER helper from 0003, which
--    is what keeps this from recursing back into patients' own policies.
-- ----------------------------------------------------------------------------
alter table public.prescriptions      enable row level security;
alter table public.prescription_items enable row level security;

drop policy if exists prescriptions_self_select on public.prescriptions;
create policy prescriptions_self_select on public.prescriptions
  for select using (patient_id in (select public.current_patient_ids()));

drop policy if exists prescription_items_self_select on public.prescription_items;
create policy prescription_items_self_select on public.prescription_items
  for select using (
    prescription_id in (
      select p.id from public.prescriptions p
       where p.patient_id in (select public.current_patient_ids())
    )
  );

commit;
