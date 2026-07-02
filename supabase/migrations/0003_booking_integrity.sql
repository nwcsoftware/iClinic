-- ============================================================================
-- Migration 0003: Booking integrity + RLS recursion fix
--
-- 1. Fixes "infinite recursion detected in policy" (42P17): the patient-side
--    policies referenced patients<->appointments in a loop with pre-existing
--    staff policies. A SECURITY DEFINER helper breaks the cycle by resolving
--    the caller's patient ids without re-triggering RLS.
-- 2. Adds a DB-level unique constraint so two patients can never book the
--    same doctor/date/time, even in a race. The API returns a clean 409.
--
-- Safe to run multiple times.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. RLS recursion fix
-- ----------------------------------------------------------------------------
create or replace function public.current_patient_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.patients where user_id = auth.uid()
$$;

create or replace function public.current_patient_appointment_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select a.id
    from public.appointments a
    join public.patients p on p.id = a.patient_id
   where p.user_id = auth.uid()
$$;

grant execute on function public.current_patient_ids() to authenticated;
grant execute on function public.current_patient_appointment_ids() to authenticated;

-- Recreate the patient-side policies using the helpers (no cross-table refs).
drop policy if exists appointments_self_select on public.appointments;
create policy appointments_self_select on public.appointments
  for select to authenticated
  using (patient_id in (select public.current_patient_ids()));

drop policy if exists pricing_self_select on public.appointment_pricing;
create policy pricing_self_select on public.appointment_pricing
  for select to authenticated
  using (appointment_id in (select public.current_patient_appointment_ids()));

-- ----------------------------------------------------------------------------
-- 2. No double-booking, enforced by the database itself.
--    Cancelled / no-show slots stay reusable.
-- ----------------------------------------------------------------------------
create unique index if not exists appointments_unique_active_slot
  on public.appointments (doctor_id, appointment_date, start_time)
  where status in ('scheduled', 'in_progress');

commit;
