-- ============================================================================
-- Migration 0010: Precise clinic locations
--
-- Doctors should never type coordinates. They paste a Google Maps link, use
-- their phone's GPS while standing in the clinic, or drop a pin — and we record
-- WHERE the coordinates came from so a guessed pin is distinguishable from one
-- a human confirmed.
--
--   formatted_address  — the readable address as resolved, kept alongside the
--                        doctor's own free-text `address` rather than
--                        overwriting it
--   google_maps_url    — the original pasted link, retained for support when a
--                        link could not be resolved automatically
--   location_source    — how the coordinates were obtained
--
-- latitude/longitude remain the authoritative values the map and Directions
-- use; everything here is provenance around them.
--
-- Additive and safe to run more than once. Requires 0009.
-- ============================================================================

begin;

alter table public.healthcare_locations
  add column if not exists formatted_address text,
  add column if not exists google_maps_url   text,
  add column if not exists location_source   text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'healthcare_locations_source_ck'
  ) then
    alter table public.healthcare_locations
      add constraint healthcare_locations_source_ck
      check (location_source is null or location_source in (
        'google_maps_link', 'current_location', 'map_picker', 'address_search', 'admin'
      ));
  end if;
end $$;

-- Existing rows: the 12 seeded hospitals were entered by hand, and anything a
-- doctor added before this migration came from address geocoding.
update public.healthcare_locations
   set location_source = case when is_seed then 'admin' else 'address_search' end
 where location_source is null;

commit;
