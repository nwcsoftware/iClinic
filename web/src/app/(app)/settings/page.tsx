'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import type { Profile, ReceptionistDoctorAssignment } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { UserPlus, Loader2, UserX, UserCheck, Trash2, Link, Unlink, Save } from 'lucide-react'

type ReceptionistWithAssignments = Profile & {
  assignments: (ReceptionistDoctorAssignment & { doctor_name: string })[]
}

export default function SettingsPage() {
  const { profile, loading: profileLoading } = useProfile()

  // Profile edit
  const [profileForm, setProfileForm] = useState({ full_name: '', specialty: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Receptionist management (doctor only)
  const [receptionists, setReceptionists] = useState<ReceptionistWithAssignments[]>([])
  const [loadingRecs, setLoadingRecs] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ full_name: '', email: '', password: '', phone: '' })
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [actionMsg, setActionMsg] = useState('')

  // Assign other doctors (for receptionists or doctor→receptionist)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState<ReceptionistWithAssignments | null>(null)
  const [availableDoctors, setAvailableDoctors] = useState<{ id: string; full_name: string }[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState('')
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    if (profile) {
      setProfileForm({ full_name: profile.full_name, specialty: profile.specialty ?? '', phone: profile.phone ?? '' })
    }
  }, [profile])

  const loadReceptionists = useCallback(async () => {
    if (!profile || profile.role !== 'doctor') return
    setLoadingRecs(true)
    const supabase = createClient()

    const { data: recs } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'receptionist')
      .eq('created_by', profile.id)
      .order('full_name')

    if (!recs) { setLoadingRecs(false); return }

    const recIds = recs.map((r: Profile) => r.id)
    const { data: assignments } = await supabase
      .from('receptionist_doctor_assignments')
      .select('*, profiles!receptionist_doctor_assignments_doctor_id_fkey(full_name)')
      .in('receptionist_id', recIds)

    const assignMap: Record<string, (ReceptionistDoctorAssignment & { doctor_name: string })[]> = {}
    for (const a of (assignments ?? [])) {
      if (!assignMap[a.receptionist_id]) assignMap[a.receptionist_id] = []
      assignMap[a.receptionist_id].push({
        ...a,
        doctor_name: (a as ReceptionistDoctorAssignment & { profiles?: { full_name: string } }).profiles?.full_name ?? 'Unknown',
      })
    }

    setReceptionists(recs.map((r: Profile) => ({ ...r, assignments: assignMap[r.id] ?? [] })))
    setLoadingRecs(false)
  }, [profile])

  useEffect(() => { loadReceptionists() }, [loadReceptionists])

  function setProfileField(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setProfileForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSaveProfile(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg('')
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileForm),
    })
    if (res.ok) { setSaveMsg('Profile saved.') } else { setSaveMsg('Failed to save.') }
    setSaving(false)
    setTimeout(() => setSaveMsg(''), 3000)
  }

  function setCreateField(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setCreateForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleCreate(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreating(true)
    setCreateError('')

    const res = await fetch('/api/create-receptionist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createForm),
    })

    const data = await res.json()
    if (!res.ok) { setCreateError(data.error ?? 'Failed.'); setCreating(false); return }

    setCreateForm({ full_name: '', email: '', password: '', phone: '' })
    setCreateOpen(false)
    setCreating(false)
    loadReceptionists()
  }

  async function toggleActive(rec: ReceptionistWithAssignments) {
    await fetch(`/api/receptionist/${rec.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !rec.is_active }),
    })
    loadReceptionists()
  }

  async function deleteReceptionist(id: string) {
    if (!confirm('Delete this assistant? This cannot be undone.')) return
    await fetch(`/api/receptionist/${id}`, { method: 'DELETE' })
    loadReceptionists()
  }

  async function openAssign(rec: ReceptionistWithAssignments) {
    setAssignTarget(rec)
    setSelectedDoctor('')
    const supabase = createClient()
    const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'doctor').order('full_name')
    const alreadyAssigned = new Set(rec.assignments.filter(a => a.is_active).map(a => a.doctor_id))
    setAvailableDoctors((data ?? []).filter((d: { id: string }) => !alreadyAssigned.has(d.id)))
    setAssignOpen(true)
  }

  async function handleAssign(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedDoctor || !assignTarget) return
    setAssigning(true)
    await fetch('/api/assign-doctor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receptionist_id: assignTarget.id, doctor_id: selectedDoctor }),
    })
    setAssigning(false)
    setAssignOpen(false)
    loadReceptionists()
  }

  async function unassignDoctor(assignmentId: string) {
    await fetch(`/api/assign-doctor/${assignmentId}`, { method: 'DELETE' })
    loadReceptionists()
  }

  if (profileLoading) {
    return <div className="p-8"><div className="animate-pulse h-64 bg-slate-200 rounded-xl" /></div>
  }

  return (
    <div className="p-8 space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Manage your profile and preferences</p>
      </div>

      {/* Profile */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">My Profile</CardTitle>
          <CardDescription>Update your display name, specialty, and contact info.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={profileForm.full_name} onChange={setProfileField('full_name')} required />
            </div>
            {profile?.role === 'doctor' && (
              <div className="space-y-1.5">
                <Label>Specialty</Label>
                <Input value={profileForm.specialty} onChange={setProfileField('specialty')} placeholder="e.g. Cardiology" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={profileForm.phone} onChange={setProfileField('phone')} placeholder="+966 5x..." />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </Button>
              {saveMsg && <span className={`text-sm ${saveMsg.includes('saved') ? 'text-emerald-600' : 'text-red-500'}`}>{saveMsg}</span>}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Receptionist Management — doctor only */}
      {profile?.role === 'doctor' && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Doctor Assistants</h2>
                <p className="text-sm text-slate-400">Create and manage assistants who work under you.</p>
              </div>
              <Button onClick={() => { setCreateForm({ full_name: '', email: '', password: '', phone: '' }); setCreateError(''); setCreateOpen(true) }} className="gap-2">
                <UserPlus className="w-4 h-4" />
                Create Assistant
              </Button>
            </div>

            {loadingRecs ? (
              <div className="animate-pulse space-y-3">
                {[1, 2].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl" />)}
              </div>
            ) : receptionists.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-sm">No assistants created yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {receptionists.map(rec => (
                  <Card key={rec.id} className="border-0 shadow-sm">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-800">{rec.full_name}</p>
                            <Badge variant={rec.is_active ? 'default' : 'secondary'}>
                              {rec.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          {rec.phone && <p className="text-sm text-slate-400">{rec.phone}</p>}
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-8 gap-1.5 text-xs ${rec.is_active ? 'text-amber-600 border-amber-200 hover:bg-amber-50' : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}
                            onClick={() => toggleActive(rec)}
                          >
                            {rec.is_active ? <><UserX className="w-3 h-3" /> Deactivate</> : <><UserCheck className="w-3 h-3" /> Activate</>}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-xs text-rose-500 border-rose-200 hover:bg-rose-50"
                            onClick={() => deleteReceptionist(rec.id)}
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </Button>
                        </div>
                      </div>

                      {/* Assigned doctors */}
                      <div>
                        <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">Assigned Doctors</p>
                        <div className="flex flex-wrap gap-2">
                          {rec.assignments.filter(a => a.is_active).map(a => (
                            <span key={a.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs border border-blue-100">
                              {a.doctor_name}
                              <button onClick={() => unassignDoctor(a.id)} className="hover:text-red-500 transition-colors">
                                <Unlink className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-xs"
                            onClick={() => openAssign(rec)}
                          >
                            <Link className="w-3 h-3" /> Assign Doctor
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Create Receptionist Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Doctor Assistant</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Full Name <span className="text-red-500">*</span></Label>
                <Input value={createForm.full_name} onChange={setCreateField('full_name')} required />
              </div>
              <div className="space-y-1.5">
                <Label>Email <span className="text-red-500">*</span></Label>
                <Input type="email" value={createForm.email} onChange={setCreateField('email')} required />
              </div>
              <div className="space-y-1.5">
                <Label>Password <span className="text-red-500">*</span></Label>
                <Input type="password" placeholder="Min 8 characters" value={createForm.password} onChange={setCreateField('password')} required />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={createForm.phone} onChange={setCreateField('phone')} placeholder="+966 5x..." />
              </div>
              {createError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{createError}</p>}
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Assistant
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Doctor Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Doctor to {assignTarget?.full_name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssign}>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Select Doctor <span className="text-red-500">*</span></Label>
                {availableDoctors.length === 0 ? (
                  <p className="text-sm text-slate-400">All doctors are already assigned.</p>
                ) : (
                  <select
                    value={selectedDoctor}
                    onChange={e => setSelectedDoctor(e.target.value)}
                    required
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Choose a doctor...</option>
                    {availableDoctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                  </select>
                )}
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
              {availableDoctors.length > 0 && (
                <Button type="submit" disabled={assigning || !selectedDoctor}>
                  {assigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Assign
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
