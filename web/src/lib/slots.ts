import type { SupabaseClient } from '@supabase/supabase-js'

// Computes the list of bookable "HH:MM" start times for a doctor on a given date,
// based on their weekly availability minus time-off and already-booked slots.
// Must run server-side with the service-role client (it reads other patients'
// booked slots, which RLS hides from patients).

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function toHHMM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export async function computeAvailableSlots(
  admin: SupabaseClient,
  doctorId: string,
  dateStr: string, // YYYY-MM-DD
): Promise<string[]> {
  // 0 = Sunday .. 6 = Saturday (matches the migration's weekday convention)
  const weekday = new Date(`${dateStr}T00:00:00Z`).getUTCDay()

  const [{ data: blocks }, { data: timeOff }, { data: booked }] = await Promise.all([
    admin.from('doctor_availability')
      .select('start_time, end_time, slot_minutes')
      .eq('doctor_id', doctorId).eq('weekday', weekday).eq('is_active', true),
    admin.from('doctor_time_off')
      .select('id').eq('doctor_id', doctorId).eq('off_date', dateStr),
    admin.from('appointments')
      .select('start_time').eq('doctor_id', doctorId).eq('appointment_date', dateStr)
      .neq('status', 'cancelled'),
  ])

  if (!blocks || blocks.length === 0) return []
  if (timeOff && timeOff.length > 0) return []

  const takenSet = new Set((booked ?? []).map((b: { start_time: string }) => b.start_time.slice(0, 5)))

  // If booking for today, hide past times (server local clock).
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const nowMinutes = dateStr === todayStr ? now.getHours() * 60 + now.getMinutes() : -1

  const slots = new Set<string>()
  for (const b of blocks as { start_time: string; end_time: string; slot_minutes: number }[]) {
    const start = toMinutes(b.start_time.slice(0, 5))
    const end = toMinutes(b.end_time.slice(0, 5))
    const step = b.slot_minutes || 30
    for (let t = start; t + step <= end; t += step) {
      const label = toHHMM(t)
      if (takenSet.has(label)) continue
      if (t <= nowMinutes) continue
      slots.add(label)
    }
  }

  return [...slots].sort()
}
