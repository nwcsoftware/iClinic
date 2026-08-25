'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import type { Patient } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { UserPlus, Search, Phone, Mail, Loader2, Users, MapPin } from 'lucide-react'

const emptyForm = { full_name: '', date_of_birth: '', gender: '', mobile_number: '', email: '', address: '', notes: '' }

type GeoLocation = { lat: number; lng: number; label: string } | null

export default function PatientsPage() {
  const { profile } = useProfile()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [geo, setGeo] = useState<GeoLocation>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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

      if (doctorIds.length === 0) { setPatients([]); return }

      // Patients created directly by any of these doctors
      const { data: direct } = await supabase
        .from('patients')
        .select('*')
        .in('created_by', doctorIds)
        .order('full_name')

      // Patients linked via appointments (may not have been created by this doctor)
      const { data: appts } = await supabase
        .from('appointments')
        .select('patient_id')
        .in('doctor_id', doctorIds)

      const seenIds = new Set((direct ?? []).map((p: { id: string }) => p.id))
      const extraIds = [...new Set((appts ?? []).map((a: { patient_id: string }) => a.patient_id))]
        .filter(id => !seenIds.has(id))

      let all = direct ?? []
      if (extraIds.length > 0) {
        const { data: extra } = await supabase
          .from('patients')
          .select('*')
          .in('id', extraIds)
          .order('full_name')
        all = [...all, ...(extra ?? [])].sort((a, b) => a.full_name.localeCompare(b.full_name))
      }

      setPatients(all)
    } catch (e) {
      console.error('patients load error:', e)
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => { load() }, [load])

  const filtered = patients.filter(p =>
    !query ||
    p.full_name.toLowerCase().includes(query.toLowerCase()) ||
    p.mobile_number.includes(query) ||
    (p.email ?? '').toLowerCase().includes(query.toLowerCase())
  )

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))
  }

  function captureLocation() {
    if (!navigator.geolocation) { setError('Geolocation not supported by this browser.'); return }
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        let label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
          const d = await r.json()
          label = d.display_name ?? label
        } catch { /* use raw coords if reverse geocode fails */ }
        setGeo({ lat, lng, label })
        setGeoLoading(false)
      },
      () => { setError('Could not get location. Please allow location access.'); setGeoLoading(false) },
      { timeout: 10000 }
    )
  }

  async function handleAdd(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: form.full_name,
        mobile_number: form.mobile_number,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        email: form.email || null,
        address: form.address || null,
        notes: form.notes || null,
        registration_lat: geo?.lat ?? null,
        registration_lng: geo?.lng ?? null,
        registration_location: geo?.label ?? null,
      }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to save patient.'); setSaving(false); return }

    setForm(emptyForm)
    setGeo(null)
    setOpen(false)
    setSaving(false)
    load()
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Patients</h1>
          <p className="text-slate-400 text-sm mt-1">{patients.length} total patients</p>
        </div>
        {profile?.role === 'doctor' && (
          <Button onClick={() => { setForm(emptyForm); setGeo(null); setError(''); setOpen(true) }} className="gap-2">
            <UserPlus className="w-4 h-4" />
            Add Patient
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by name, phone, or email..."
          className="pl-9"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading patients...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Users className="w-10 h-10 opacity-30" />
            <p>{query ? 'No patients match your search.' : 'No patients yet.'}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Name</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Date of Birth</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => (
                <TableRow key={p.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-medium text-slate-800">{p.full_name}</TableCell>
                  <TableCell className="capitalize text-slate-500">{p.gender ?? '-'}</TableCell>
                  <TableCell className="text-slate-500">
                    {p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <Phone className="w-3.5 h-3.5" /> {p.mobile_number}
                    </span>
                  </TableCell>
                  <TableCell>
                    {p.email
                      ? <span className="flex items-center gap-1.5 text-slate-600"><Mail className="w-3.5 h-3.5" /> {p.email}</span>
                      : <span className="text-slate-300">-</span>}
                  </TableCell>
                  <TableCell className="max-w-[160px]">
                    {p.registration_location ? (
                      <span className="flex items-start gap-1 text-slate-500 text-xs">
                        <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" />
                        <span className="truncate" title={p.registration_location}>{p.registration_location}</span>
                      </span>
                    ) : <span className="text-slate-300">-</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.is_email_verified || p.is_mobile_verified ? 'default' : 'secondary'}>
                      {p.is_email_verified ? 'Verified' : 'Unverified'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add Patient Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Patient</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd}>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="p_name">Full Name <span className="text-red-500">*</span></Label>
                <Input id="p_name" placeholder="Patient full name" value={form.full_name} onChange={set('full_name')} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p_mobile">Mobile Number <span className="text-red-500">*</span></Label>
                <Input id="p_mobile" placeholder="+966 5x xxx xxxx" value={form.mobile_number} onChange={set('mobile_number')} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="p_dob">Date of Birth</Label>
                  <Input id="p_dob" type="date" value={form.date_of_birth} onChange={set('date_of_birth')} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p_gender">Gender</Label>
                  <select
                    id="p_gender"
                    value={form.gender}
                    onChange={set('gender')}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p_email">Email</Label>
                <Input id="p_email" type="email" placeholder="patient@email.com" value={form.email} onChange={set('email')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p_address">Address</Label>
                <Input id="p_address" placeholder="City, street..." value={form.address} onChange={set('address')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p_notes">Notes</Label>
                <Input id="p_notes" placeholder="Any relevant notes..." value={form.notes} onChange={set('notes')} />
              </div>
              <div className="space-y-1.5">
                <Label>Patient Location</Label>
                {geo ? (
                  <div className="flex items-start gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-md text-sm text-emerald-700">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="break-all">{geo.label}</span>
                    <button type="button" onClick={() => setGeo(null)} className="ml-auto text-emerald-400 hover:text-emerald-700 shrink-0">✕</button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={captureLocation} disabled={geoLoading} className="gap-2 w-full">
                    {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                    {geoLoading ? 'Getting location…' : 'Capture Location'}
                  </Button>
                )}
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Patient
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
