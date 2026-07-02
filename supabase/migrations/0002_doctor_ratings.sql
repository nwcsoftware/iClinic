-- ============================================================================
-- Migration 0002: Doctor ratings
--   - rating (0-5) + review_count on profiles
--   - expose both through the public_doctors view
--   - seed demo ratings for the current doctors
-- Safe to run multiple times.
-- ============================================================================

begin;

alter table public.profiles
  add column if not exists rating numeric(2,1)
    check (rating is null or (rating >= 0 and rating <= 5));

alter table public.profiles
  add column if not exists review_count integer not null default 0;

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
  where p.role = 'doctor' and p.is_active;

grant select on public.public_doctors to anon, authenticated;

-- Demo ratings
update public.profiles p
   set rating = v.r, review_count = v.c
  from (values
    ('Nicolas Chami',     4.8, 132),
    ('Lara Haddad',       4.9, 208),
    ('Omar Fakhoury',     4.6,  87),
    ('Rami Khoury',       4.7, 154),
    ('Maya Saab',         4.9, 261),
    ('Karim Nassar',      4.5,  73),
    ('Nour El Din',       4.7, 190),
    ('Hala Mansour',      4.8, 119),
    ('Ziad Barakat',      4.4,  58),
    ('Dana Aoun',         4.6,  96),
    ('Samir Gerges',      4.7, 142),
    ('Dr. Maya Haddad',   4.9, 212),
    ('Dr. Omar Fakhoury', 4.8, 167),
    ('Dr. Lina Khoury',   4.9, 198),
    ('Dr. Karim Nassar',  4.7, 141),
    ('Dr. Rania Aoun',    4.8, 122),
    ('Dr. Samir Gerges',  4.6,  98),
    ('Dr. Nour Saliba',   4.9, 175),
    ('Dr. Elie Rahme',    4.7, 110),
    ('Dr. Dana Sleiman',  4.8, 156),
    ('Dr. Hadi Mansour',  4.6,  87)
  ) as v(name, r, c)
 where p.full_name = v.name and p.role = 'doctor';

commit;
