'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import type { Prescription, PrescriptionItem } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FilePlus, Search, Loader2, FileText, Printer, Plus, Trash2 } from 'lucide-react'

type RxWithNames = Prescription & {
  patient_name: string
  doctor_name: string
  items: PrescriptionItem[]
  appointment_date?: string
}

const emptyItem = { medication_name: '', dosage: '', frequency: '', duration: '', route: '', notes: '' }

export default function PrescriptionsPage() {
  const { profile } = useProfile()
  const [rxList, setRxList] = useState<RxWithNames[]>([])
  const [patients, setPatients] = useState<{ id: string; full_name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [printRx, setPrintRx] = useState<RxWithNames | null>(null)
  const [form, setForm] = useState({
    patient_id: '', appointment_id: '', diagnosis_note: '', notes: '', valid_until: ''
  })
  const [items, setItems] = useState([{ ...emptyItem }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const printRef = useRef<HTMLDivElement>(null)

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

      if (doctorIds.length === 0) { setRxList([]); return }

      const { data: rxs } = await supabase
        .from('prescriptions')
        .select(`
          *,
          patients(full_name),
          profiles!prescriptions_doctor_id_fkey(full_name),
          prescription_items(*),
          appointments(appointment_date)
        `)
        .in('doctor_id', doctorIds)
        .order('created_at', { ascending: false })
        .limit(100)

      setRxList(
        (rxs ?? []).map((r: Prescription & {
          patients?: { full_name: string }
          profiles?: { full_name: string }
          prescription_items?: PrescriptionItem[]
          appointments?: { appointment_date: string }
        }) => ({
          ...r,
          patient_name: r.patients?.full_name ?? 'Unknown',
          doctor_name: r.profiles?.full_name ?? 'Unknown',
          items: (r.prescription_items ?? []).sort((a, b) => a.sort_order - b.sort_order),
          appointment_date: r.appointments?.appointment_date,
        }))
      )

      if (profile.role === 'doctor') {
        const { data: pts } = await supabase.from('patients').select('id, full_name').order('full_name')
        setPatients(pts ?? [])
      }
    } catch (e) {
      console.error('prescriptions load error:', e)
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => { load() }, [load])

  const filtered = rxList.filter(r => {
    if (!query) return true
    const q = query.toLowerCase()
    return r.patient_name.toLowerCase().includes(q) || r.prescription_number.toLowerCase().includes(q)
  })

  function setField(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))
  }

  function setItem(i: number, field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: e.target.value } : item))
    }
  }

  function addItem() { setItems(prev => [...prev, { ...emptyItem }]) }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)) }

  async function handleCreate(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch('/api/prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: form.patient_id,
        appointment_id: form.appointment_id || null,
        diagnosis_note: form.diagnosis_note || null,
        notes: form.notes || null,
        valid_until: form.valid_until || null,
        items: items.filter(it => it.medication_name.trim()).map((it, idx) => ({ ...it, sort_order: idx })),
      }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to save.'); setSaving(false); return }

    setOpen(false)
    setSaving(false)
    load()
  }

  async function handlePrint(rx: RxWithNames) {
    setPrintRx(rx)
    // Mark as printed
    await fetch(`/api/prescriptions/${rx.id}/print`, { method: 'POST' })
    setTimeout(() => { window.print() }, 300)
    load()
  }

  return (
    <div className="p-8 space-y-6 print:p-0">
      {/* Print layout */}
      {printRx && (
        <div ref={printRef} className="hidden print:block p-8 font-sans">
          <div className="border-b pb-4 mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">Prescription</h1>
              <p className="text-gray-500 text-sm">#{printRx.prescription_number}</p>
            </div>
            <div className="text-right text-sm text-gray-600">
              <p className="font-semibold">{printRx.doctor_name}</p>
              <p>{new Date(printRx.created_at).toLocaleDateString()}</p>
              {printRx.valid_until && <p>Valid until: {new Date(printRx.valid_until).toLocaleDateString()}</p>}
            </div>
          </div>
          <div className="mb-6">
            <p className="font-semibold text-gray-700">Patient: <span className="font-normal">{printRx.patient_name}</span></p>
            {printRx.diagnosis_note && (
              <p className="mt-2 text-sm text-gray-700"><span className="font-semibold">Diagnosis:</span> {printRx.diagnosis_note}</p>
            )}
          </div>
          <table className="w-full text-sm border-collapse mb-6">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 pr-4">Medication</th>
                <th className="text-left py-2 pr-4">Dosage</th>
                <th className="text-left py-2 pr-4">Frequency</th>
                <th className="text-left py-2 pr-4">Duration</th>
                <th className="text-left py-2">Route</th>
              </tr>
            </thead>
            <tbody>
              {printRx.items.map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2 pr-4 font-medium">{item.medication_name}</td>
                  <td className="py-2 pr-4 text-gray-600">{item.dosage ?? '—'}</td>
                  <td className="py-2 pr-4 text-gray-600">{item.frequency ?? '—'}</td>
                  <td className="py-2 pr-4 text-gray-600">{item.duration ?? '—'}</td>
                  <td className="py-2 text-gray-600">{item.route ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {printRx.notes && (
            <p className="text-sm text-gray-600 border-t pt-4"><span className="font-semibold">Notes:</span> {printRx.notes}</p>
          )}
          <div className="mt-12 flex justify-end">
            <div className="text-center">
              <div className="border-t border-gray-400 w-48 mt-8 pt-2 text-sm text-gray-500">Doctor Signature</div>
            </div>
          </div>
        </div>
      )}

      {/* Screen layout */}
      <div className="print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Prescriptions</h1>
            <p className="text-slate-400 text-sm mt-1">{rxList.length} total records</p>
          </div>
          {profile?.role === 'doctor' && (
            <Button onClick={() => { setForm({ patient_id: '', appointment_id: '', diagnosis_note: '', notes: '', valid_until: '' }); setItems([{ ...emptyItem }]); setError(''); setOpen(true) }} className="gap-2">
              <FilePlus className="w-4 h-4" />
              New Prescription
            </Button>
          )}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search patient or Rx number..." className="pl-9" value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <FileText className="w-10 h-10 opacity-30" />
              <p>{query ? 'No matches found.' : 'No prescriptions yet.'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Rx #</TableHead>
                  <TableHead>Patient</TableHead>
                  {profile?.role === 'receptionist' && <TableHead>Doctor</TableHead>}
                  <TableHead>Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Printed</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(rx => (
                  <TableRow key={rx.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-mono text-xs text-slate-500">{rx.prescription_number}</TableCell>
                    <TableCell className="font-medium text-slate-800">{rx.patient_name}</TableCell>
                    {profile?.role === 'receptionist' && <TableCell className="text-slate-500">{rx.doctor_name}</TableCell>}
                    <TableCell className="text-slate-500">{new Date(rx.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-slate-500">{rx.items.length} item{rx.items.length !== 1 ? 's' : ''}</TableCell>
                    <TableCell>
                      {rx.is_printed
                        ? <Badge variant="secondary" className="text-xs">Printed</Badge>
                        : <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">Not printed</Badge>
                      }
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => handlePrint(rx)}>
                        <Printer className="w-3 h-3" />
                        Print
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* New Prescription Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Prescription</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Patient <span className="text-red-500">*</span></Label>
                <select
                  value={form.patient_id}
                  onChange={setField('patient_id')}
                  required
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select patient...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Valid Until</Label>
                  <Input type="date" value={form.valid_until} onChange={setField('valid_until')} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Diagnosis / Notes</Label>
                <Input placeholder="Diagnosis summary..." value={form.diagnosis_note} onChange={setField('diagnosis_note')} />
              </div>

              {/* Medications */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Medications</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-7 gap-1 text-xs">
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                </div>
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2 items-end p-3 bg-slate-50 rounded-lg">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Medication *</Label>
                      <Input className="h-8 text-sm" placeholder="Drug name" value={item.medication_name} onChange={setItem(i, 'medication_name')} required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Dosage</Label>
                      <Input className="h-8 text-sm" placeholder="500mg" value={item.dosage} onChange={setItem(i, 'dosage')} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Frequency</Label>
                      <Input className="h-8 text-sm" placeholder="3x/day" value={item.frequency} onChange={setItem(i, 'frequency')} />
                    </div>
                    <div className="flex gap-1 items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Duration</Label>
                        <Input className="h-8 text-sm" placeholder="7 days" value={item.duration} onChange={setItem(i, 'duration')} />
                      </div>
                      {items.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-rose-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => removeItem(i)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label>Additional Notes</Label>
                <Input placeholder="Special instructions..." value={form.notes} onChange={setField('notes')} />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Prescription
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
