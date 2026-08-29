import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSubscribedDoctor } from '@/lib/doctor-auth'
import { getRequestMeta } from '@/lib/request-meta'

// ---------------------------------------------------------------------------
// A doctor's secretaries.
//
// GET    — the doctor's secretaries, their granted locations, slots remaining
// POST   — create one, or attach an existing secretary account to this doctor
// PATCH  — activate/deactivate, or replace the set of granted locations
// DELETE — end this doctor's relationship with them
//
// DELETE never touches the secretary's login. One person can work for several
// doctors on one account, so removing them here removes them from here: their
// other doctors, and their ability to sign in, are none of this doctor's
// business.
//
// The three-secretary limit is enforced in the database as well, so it holds
// for any route that ever inserts, not only this one.
// ---------------------------------------------------------------------------

const MAX_SECRETARIES = 3

type Grant = { doctor_location_id: string }

async function loadSecretaries(admin: ReturnType<typeof createAdminClient>, doctorId: string) {
  const { data, error } = await admin
    .from('doctor_secretaries')
    .select(`
      id, status, created_at, secretary_id,
      profiles!doctor_secretaries_secretary_id_fkey ( full_name, phone, is_active ),
      doctor_secretary_locations (
        id, doctor_location_id,
        doctor_locations ( id, location_id, healthcare_locations ( name, type, city ) )
      )
    `)
    .eq('doctor_id', doctorId)
    .order('created_at', { ascending: true })

  if (error) return { rows: null, error }

  type Row = {
    id: string; status: string; created_at: string; secretary_id: string
    profiles: { full_name: string; phone: string | null; is_active: boolean } | null
    doctor_secretary_locations: {
      id: string; doctor_location_id: string
      doctor_locations: {
        id: string; location_id: string
        healthcare_locations: { name: string; type: string; city: string | null } | null
      } | null
    }[]
  }

  const rows = ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    secretary_id: r.secretary_id,
    full_name: r.profiles?.full_name ?? 'Secretary',
    phone: r.profiles?.phone ?? null,
    account_active: r.profiles?.is_active ?? true,
    status: r.status,
    created_at: r.created_at,
    locations: (r.doctor_secretary_locations ?? [])
      .filter((g) => g.doctor_locations)
      .map((g) => ({
        grant_id: g.id,
        doctor_location_id: g.doctor_location_id,
        location_id: g.doctor_locations!.location_id,
        name: g.doctor_locations!.healthcare_locations?.name ?? 'Location',
        type: g.doctor_locations!.healthcare_locations?.type ?? 'clinic',
        city: g.doctor_locations!.healthcare_locations?.city ?? null,
      })),
  }))
  return { rows, error: null }
}

export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const { doctor, access } = await requireSubscribedDoctor(request, admin)
    if (!doctor) {
      return access
        ? NextResponse.json({ error: 'Subscription required', subscription_required: true }, { status: 402 })
        : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { rows, error } = await loadSecretaries(admin, doctor.id)
    // Migration 0011 not applied yet: report the feature as off rather than
    // breaking the dashboard that asks for it.
    if (error) return NextResponse.json({ secretaries: [], max: MAX_SECRETARIES, enabled: false })

    return NextResponse.json({
      secretaries: rows,
      used: rows!.length,
      max: MAX_SECRETARIES,
      remaining: Math.max(0, MAX_SECRETARIES - rows!.length),
      enabled: true,
    })
  } catch (err) {
    console.error('doctor/secretaries GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const admin = createAdminClient()
    const { doctor, access } = await requireSubscribedDoctor(request, admin)
    if (!doctor) {
      return access
        ? NextResponse.json({ error: 'Subscription required', subscription_required: true }, { status: 402 })
        : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const grants: string[] = Array.isArray(body.doctor_location_ids)
      ? body.doctor_location_ids.filter((x: unknown) => typeof x === 'string')
      : []

    if (!fullName) return NextResponse.json({ error: 'A name is required' }, { status: 400 })
    if (!email) return NextResponse.json({ error: 'An email is required' }, { status: 400 })
    if (password.length < 8) {
      return NextResponse.json({ error: 'The password must be at least 8 characters' }, { status: 400 })
    }

    // Checked here for a readable message; the database enforces it too.
    const { count } = await admin
      .from('doctor_secretaries')
      .select('id', { count: 'exact', head: true })
      .eq('doctor_id', doctor.id)
    if ((count ?? 0) >= MAX_SECRETARIES) {
      return NextResponse.json(
        { error: `You already have ${MAX_SECRETARIES} secretaries. Remove one to add another.` },
        { status: 409 },
      )
    }

    // An existing secretary may already work for another doctor. Reuse that
    // account rather than making them a second login for the same job.
    const { data: existingProfile } = await admin
      .from('profiles').select('id, role').eq('id', body.secretary_id ?? '00000000-0000-0000-0000-000000000000').maybeSingle()

    let secretaryId: string | null = existingProfile?.role === 'secretary' ? existingProfile.id : null
    let createdAccount = false

    if (!secretaryId) {
      const { ip, device } = getRequestMeta(request)
      const { data: auth, error: authError } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      })
      if (authError) {
        return NextResponse.json(
          { error: /already|registered|exists/i.test(authError.message)
              ? 'An account with that email already exists. Ask them for their account instead.'
              : authError.message },
          { status: 400 },
        )
      }
      const { error: profileError } = await admin.from('profiles').insert({
        id: auth.user.id,
        role: 'secretary',
        full_name: fullName,
        phone: phone || null,
        created_by: doctor.id,
        created_from_ip: ip,
        created_from_device: device,
      })
      if (profileError) {
        await admin.auth.admin.deleteUser(auth.user.id)
        return NextResponse.json({ error: profileError.message }, { status: 400 })
      }
      secretaryId = auth.user.id
      createdAccount = true
    }

    const { data: link, error: linkError } = await admin
      .from('doctor_secretaries')
      .insert({ doctor_id: doctor.id, secretary_id: secretaryId, created_by: doctor.id })
      .select('id').single()

    if (linkError) {
      // The account is kept if it already existed; only a just-created one is
      // rolled back, so a failure here cannot orphan someone else's login.
      if (createdAccount) await admin.auth.admin.deleteUser(secretaryId)
      const conflict = linkError.code === '23505'
      return NextResponse.json(
        { error: conflict ? 'That secretary already works for you.' : linkError.message },
        { status: conflict ? 409 : 400 },
      )
    }

    // Locations are granted explicitly. None named, none granted.
    const valid = await filterOwnedLocations(admin, doctor.id, grants)
    if (valid.length > 0) {
      await admin.from('doctor_secretary_locations').insert(
        valid.map((id) => ({ doctor_secretary_id: link.id, doctor_location_id: id })),
      )
    }

    return NextResponse.json({ id: link.id, secretary_id: secretaryId, granted: valid.length }, { status: 201 })
  } catch (err) {
    console.error('doctor/secretaries POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = createAdminClient()
    const { doctor, access } = await requireSubscribedDoctor(request, admin)
    if (!doctor) {
      return access
        ? NextResponse.json({ error: 'Subscription required', subscription_required: true }, { status: 402 })
        : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    // The link must be this doctor's. Without this a doctor could edit another
    // doctor's grants by guessing an id.
    const { data: link } = await admin
      .from('doctor_secretaries').select('id, doctor_id').eq('id', id).maybeSingle()
    if (!link || link.doctor_id !== doctor.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (body.status === 'active' || body.status === 'inactive') {
      await admin.from('doctor_secretaries')
        .update({ status: body.status, updated_at: new Date().toISOString() })
        .eq('id', id)
    }

    // Replacing the set is deliberate: revoking is removing a name from the
    // list, so the new list is the whole truth and anything absent stops
    // working immediately.
    if (Array.isArray(body.doctor_location_ids)) {
      const wanted = await filterOwnedLocations(
        admin, doctor.id,
        body.doctor_location_ids.filter((x: unknown) => typeof x === 'string'),
      )
      await admin.from('doctor_secretary_locations').delete().eq('doctor_secretary_id', id)
      if (wanted.length > 0) {
        await admin.from('doctor_secretary_locations').insert(
          wanted.map((locId) => ({ doctor_secretary_id: id, doctor_location_id: locId })),
        )
      }
    }

    const { rows } = await loadSecretaries(admin, doctor.id)
    return NextResponse.json({ secretaries: rows ?? [] })
  } catch (err) {
    console.error('doctor/secretaries PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = createAdminClient()
    const { doctor, access } = await requireSubscribedDoctor(request, admin)
    if (!doctor) {
      return access
        ? NextResponse.json({ error: 'Subscription required', subscription_required: true }, { status: 402 })
        : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const { data: link } = await admin
      .from('doctor_secretaries').select('id, doctor_id, secretary_id').eq('id', id).maybeSingle()
    if (!link || link.doctor_id !== doctor.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Grants go with it by cascade. The account does not: it may be in use by
    // another doctor, and it is not this doctor's to delete either way.
    await admin.from('doctor_secretaries').delete().eq('id', id)

    const { count } = await admin
      .from('doctor_secretaries')
      .select('id', { count: 'exact', head: true })
      .eq('secretary_id', link.secretary_id)

    return NextResponse.json({
      removed: true,
      // Told to the doctor so "remove" is not mistaken for "delete their account".
      still_works_for_others: (count ?? 0) > 0,
    })
  } catch (err) {
    console.error('doctor/secretaries DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Keeps only the workplace ids that genuinely belong to this doctor. */
async function filterOwnedLocations(
  admin: ReturnType<typeof createAdminClient>,
  doctorId: string,
  ids: string[],
): Promise<string[]> {
  if (ids.length === 0) return []
  const { data } = await admin
    .from('doctor_locations').select('id').eq('doctor_id', doctorId).in('id', ids)
  return (data ?? []).map((r) => r.id as string)
}
