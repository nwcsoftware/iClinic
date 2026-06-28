'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import type { Appointment, AppointmentStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CalendarPlus, Search, Loader2, CalendarDays } from 'lucide-react'

type ApptWithNames = Appointment & { patient_name: string; doctor_name?: string }

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  no_show: 'bg-rose-50 text-rose-700 border-rose-200',
}

const emptyForm = {
  patient_id: '', appointment_date: new Date().toISOString().split('T')[0],
  start_time: '09:00', end_time: '', reason: '', notes: '', base_price: '0', currency: 'SAR'
}

export default function AppointmentsPage() {
  const { profile } = useProfile()
  const [appointments, setAppointments] = useState<ApptWithNames[]>([])
  const [patients, setPatients] = useState<{ id: string; full_name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'all'>('all')
  const [dateFilter, setDateFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!profile) { setLoading(false); return }
    try {
      const supabase = createClient()

      let doctorIds: string[] = []
      if (profile.role === 'doctor') {
        doctorIds = [profile.id]
      } else {
        const { data } = await supabase
          .from('receptionist_doctor_assignments')
          .select('doctor_id')
          .eq('receptionist_id', profile.id)
          .eq('is_active', true)
        doctorIds = (data ?? []).map((a: { doctor_id: string }) => a.doctor_id)
      }

      if (doctorIds.length === 0) { setAppointments([]); return }

      const { data: appts } = await supabase
        .from('appointments')
        .select('*, patients(full_name), profiles!appointments_doctor_id_fkey(full_name)')
        .in('doctor_id', doctorIds)
        .order('appointment_date', { ascending: false })
        .order('start_time', { ascending: false })
        .limit(200)

      setAppointments(
        (appts ?? []).map((a: Appointment & { patients?: { full_name: string }; profiles?: { full_name: string } }) => ({
          ...a,
          patient_name: a.patients?.full_name ?? 'Unknown',
          doctor_name: a.profiles?.full_name,
        }))
      )

      if (profile.role === 'doctor') {
        const { data: pts } = await supabase
          .from('patients')
          .select('id, full_name')
          .order('full_name')
        setPatients(pts ?? [])
      }
    } catch (e) {
      console.error('appointments load error:', e)
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => { load() }, [load])

  const filtered = appointments.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (dateFilter && a.appointment_date !== dateFilter) return false
    if (query) {
      const q = query.toLowerCase()
      return a.patient_name.toLowerCase().includes(q) || (a.reason ?? '').toLowerCase().includes(q)
    }
    return true
  })

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleAdd(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: form.patient_id,
        appointment_date: form.appointment_date,
        start_time: form.start_time,
        end_time: form.end_time || null,
        reason: form.reason || null,
        notes: form.notes || null,
        base_price: parseFloat(form.base_price) || 0,
        currency: form.currency,
      }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to save.'); setSaving(false); return }

    setForm(emptyForm)
    setOpen(false)
    setSaving(false)
    load()
  }

  async function updateStatus(id: string, status: AppointmentStatus) {
    setUpdatingId(id)
    await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setUpdatingId(null)
    load()
  }

  const statuses: AppointmentStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show']

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Appointments</h1>
          <p className="text-slate-400 text-sm mt-1">{appointments.length} total records</p>
        </div>
        {profile?.role === 'doctor' && (
          <Button onClick={() => { setForm(emptyForm); setError(''); setOpen(true) }} className="gap-2">
            <CalendarPlus className="w-4 h-4" />
            New Appointment
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search patient or reason..." className="pl-9" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <Input type="date" className="w-44" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as AppointmentStatus | 'all')}
          className="h-9 rounded-md border border-input bg-white px-3 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All Statuses</option>
          {statuses.map(s => <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>)}
        </select>
        {(query || dateFilter || statusFilter !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setQuery(''); setDateFilter(''); setStatusFilter('all') }}>
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading appointments...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <CalendarDays className="w-10 h-10 opacity-30" />
            <p>No appointments found.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Patient</TableHead>
                {profile?.role === 'receptionist' && <TableHead>Doctor</TableHead>}
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                {profile?.role === 'doctor' && <TableHead>Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(a => (
                <TableRow key={a.id} className="hover:bg-slate-50/50">
                  <TableCell className="text-slate-600 whitespace-nowrap">
                    {new Date(a.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </TableCell>
                  <TableCell className="text-slate-600 whitespace-nowrap">{a.start_time.slice(0, 5)}</TableCell>
                  <TableCell className="font-medium text-slate-800">{a.patient_name}</TableCell>
                  {profile?.role === 'receptionist' && <TableCell className="text-slate-500">{a.doctor_name ?? '—'}</TableCell>}
                  <TableCell className="text-slate-500 max-w-[180px] truncate">{a.reason ?? '—'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_COLORS[a.status]}`}>
                      {a.status.replace('_', ' ')}
                    </span>
                  </TableCell>
                  {profile?.role === 'doctor' && (
                    <TableCell>
                      {updatingId === a.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      ) : (
                        <div className="flex gap-1">
                          {a.status === 'scheduled' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(a.id, 'in_progress')}>
                              Start
                            </Button>
                          )}
                          {a.status === 'in_progress' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => updateStatus(a.id, 'completed')}>
                              Complete
                            </Button>
                          )}
                          {(a.status === 'scheduled' || a.status === 'in_progress') && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50" onClick={() => updateStatus(a.id, 'cancelled')}>
                              Cancel
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* New Appointment Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Appointment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd}>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Patient <span className="text-red-500">*</span></Label>
                <select
                  value={form.patient_id}
                  onChange={set('patient_id')}
                  required
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select patient...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date <span className="text-red-500">*</span></Label>
                  <Input type="date" value={form.appointment_date} onChange={set('appointment_date')} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Start Time <span className="text-red-500">*</span></Label>
                  <Input type="time" value={form.start_time} onChange={set('start_time')} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>End Time</Label>
                  <Input type="time" value={form.end_time} onChange={set('end_time')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Price (SAR)</Label>
                  <Input type="number" min="0" step="0.01" value={form.base_price} onChange={set('base_price')} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Reason</Label>
                <Input placeholder="Visit reason..." value={form.reason} onChange={set('reason')} />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input placeholder="Internal notes..." value={form.notes} onChange={set('notes')} />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Book Appointment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
