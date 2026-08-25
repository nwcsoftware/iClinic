'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import type { AppointmentPricing, PaymentStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, DollarSign, TrendingUp, Clock, Search } from 'lucide-react'

type PricingRow = AppointmentPricing & {
  patient_name: string
  doctor_name: string
  appointment_date: string
}

const STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  waived: 'bg-slate-100 text-slate-500 border-slate-200',
}

export default function FinancesPage() {
  const { profile } = useProfile()
  const [rows, setRows] = useState<PricingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all')
  const [monthFilter, setMonthFilter] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [updating, setUpdating] = useState<string | null>(null)
  const [doctorFilter, setDoctorFilter] = useState<string>('all')
  const [doctors, setDoctors] = useState<{ id: string; full_name: string }[]>([])

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
          .select('doctor_id, profiles!receptionist_doctor_assignments_doctor_id_fkey(full_name)')
          .eq('receptionist_id', profile.id)
          .eq('is_active', true)
        doctorIds = (data ?? []).map((a: { doctor_id: string }) => a.doctor_id)
        const docList = (data ?? []).map((a: { doctor_id: string; profiles?: { full_name: string } | { full_name: string }[] | null }) => ({
          id: a.doctor_id,
          full_name: (Array.isArray(a.profiles) ? a.profiles[0]?.full_name : (a.profiles as { full_name: string } | null)?.full_name) ?? a.doctor_id,
        }))
        setDoctors(docList)
      }

      if (doctorIds.length === 0) { setRows([]); return }

      const [monthStart, monthEnd] = (() => {
        const [y, m] = monthFilter.split('-').map(Number)
        return [
          new Date(y, m - 1, 1).toISOString(),
          new Date(y, m, 0, 23, 59, 59).toISOString(),
        ]
      })()

      const { data } = await supabase
        .from('appointment_pricing')
        .select(`
          *,
          appointments!inner(
            appointment_date,
            patients(full_name),
            profiles!appointments_doctor_id_fkey(full_name)
          )
        `)
        .in('doctor_id', doctorIds)
        .gte('appointments.appointment_date', monthStart.split('T')[0])
        .lte('appointments.appointment_date', monthEnd.split('T')[0])
        .order('created_at', { ascending: false })

      setRows(
        (data ?? []).map((r: AppointmentPricing & {
          appointments?: {
            appointment_date: string
            patients?: { full_name: string }
            profiles?: { full_name: string }
          }
        }) => ({
          ...r,
          patient_name: r.appointments?.patients?.full_name ?? 'Unknown',
          doctor_name: r.appointments?.profiles?.full_name ?? 'Unknown',
          appointment_date: r.appointments?.appointment_date ?? '',
        }))
      )
    } catch (e) {
      console.error('finances load error:', e)
    } finally {
      setLoading(false)
    }
  }, [profile, monthFilter])

  useEffect(() => { load() }, [load])

  async function markPaid(id: string) {
    setUpdating(id)
    await fetch(`/api/payments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_status: 'paid', paid_at: new Date().toISOString() }),
    })
    setUpdating(null)
    load()
  }

  async function markWaived(id: string) {
    setUpdating(id)
    await fetch(`/api/payments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_status: 'waived' }),
    })
    setUpdating(null)
    load()
  }

  const filtered = rows.filter(r => {
    if (statusFilter !== 'all' && r.payment_status !== statusFilter) return false
    if (doctorFilter !== 'all' && r.doctor_id !== doctorFilter) return false
    if (query) {
      const q = query.toLowerCase()
      return r.patient_name.toLowerCase().includes(q) || r.doctor_name.toLowerCase().includes(q)
    }
    return true
  })

  const totalPaid = filtered.filter(r => r.payment_status === 'paid').reduce((s, r) => s + Number(r.net_amount), 0)
  const totalPending = filtered.filter(r => r.payment_status === 'pending').reduce((s, r) => s + Number(r.net_amount), 0)
  const totalWaived = filtered.filter(r => r.payment_status === 'waived').reduce((s, r) => s + Number(r.net_amount), 0)

  const statuses: PaymentStatus[] = ['pending', 'paid', 'waived']

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Finances</h1>
        <p className="text-slate-400 text-sm mt-1">Payment tracking and revenue overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Collected</p>
              <p className="text-xl font-bold text-slate-800">SAR {totalPaid.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Pending</p>
              <p className="text-xl font-bold text-slate-800">SAR {totalPending.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Waived</p>
              <p className="text-xl font-bold text-slate-800">SAR {totalWaived.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input type="month" className="w-40" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search patient or doctor..." className="pl-9" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as PaymentStatus | 'all')}
          className="h-9 rounded-md border border-input bg-white px-3 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All Status</option>
          {statuses.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
        {profile?.role === 'receptionist' && doctors.length > 0 && (
          <select
            value={doctorFilter}
            onChange={e => setDoctorFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-white px-3 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All Doctors</option>
            {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <DollarSign className="w-10 h-10 opacity-30" />
            <p>No payment records found.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Date</TableHead>
                <TableHead>Patient</TableHead>
                {profile?.role === 'receptionist' && <TableHead>Doctor</TableHead>}
                <TableHead>Base</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id} className="hover:bg-slate-50/50">
                  <TableCell className="text-slate-500 whitespace-nowrap">
                    {r.appointment_date ? new Date(r.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                  </TableCell>
                  <TableCell className="font-medium text-slate-800">{r.patient_name}</TableCell>
                  {profile?.role === 'receptionist' && <TableCell className="text-slate-500">{r.doctor_name}</TableCell>}
                  <TableCell className="text-slate-500">{Number(r.base_price).toLocaleString()}</TableCell>
                  <TableCell className="text-rose-500">{Number(r.discount_amount) > 0 ? `-${Number(r.discount_amount).toLocaleString()}` : '-'}</TableCell>
                  <TableCell className="font-semibold text-slate-800">{Number(r.net_amount).toLocaleString()} <span className="text-xs text-slate-400">{r.currency}</span></TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_COLORS[r.payment_status]}`}>
                      {r.payment_status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {updating === r.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    ) : r.payment_status === 'pending' ? (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => markPaid(r.id)}>
                          Mark Paid
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400 hover:text-slate-600" onClick={() => markWaived(r.id)}>
                          Waive
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
