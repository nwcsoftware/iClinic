'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import SecretaryOverview from '@/components/secretary/Overview'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarDays, Users, DollarSign, FileText, TrendingUp, Clock } from 'lucide-react'

interface Stats {
  todayAppointments: number
  totalPatients: number
  monthRevenue: number
  pendingPayments: number
  pendingPrescriptions: number
  completedToday: number
}

function StatCard({
  title, value, sub, icon: Icon, color
}: {
  title: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color: { bg: string; fg: string }
}) {
  return (
    <div className="icl-card icl-fade-up p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="icl-label mb-1">{title}</p>
          <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--icl-ink)', letterSpacing: '-0.5px' }}>{value}</p>
          {sub && <p className="icl-small mt-1">{sub}</p>}
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center"
          style={{ background: color.bg, color: color.fg, borderRadius: 'var(--icl-r-md)' }}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { profile, loading: profileLoading } = useProfile()
  
  // A secretary's dashboard is a different job from a doctor's, so it is a
  // different screen rather than the same one with pieces removed.
  if (profile?.role === 'receptionist') return <SecretaryOverview />
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profileLoading) return
    if (!profile) { setLoading(false); return }

    async function fetchStats() {
      try {
        const supabase = createClient()
        const today = new Date().toISOString().split('T')[0]
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

        let doctorIds: string[] = []

        if (profile!.role === 'doctor') {
          doctorIds = [profile!.id]
        } else {
          const { data: assignments } = await supabase
            .from('receptionist_doctor_assignments')
            .select('doctor_id')
            .eq('receptionist_id', profile!.id)
            .eq('is_active', true)
          doctorIds = (assignments ?? []).map((a: { doctor_id: string }) => a.doctor_id)
        }

        if (doctorIds.length === 0) {
          setStats({ todayAppointments: 0, totalPatients: 0, monthRevenue: 0, pendingPayments: 0, pendingPrescriptions: 0, completedToday: 0 })
          setLoading(false)
          return
        }

        const [apptToday, apptCompleted, patients, monthPricing, pendingPricing, rxPending] = await Promise.all([
          supabase.from('appointments').select('id', { count: 'exact', head: true })
            .in('doctor_id', doctorIds).eq('appointment_date', today).neq('status', 'cancelled'),
          supabase.from('appointments').select('id', { count: 'exact', head: true })
            .in('doctor_id', doctorIds).eq('appointment_date', today).eq('status', 'completed'),
          supabase.from('appointments').select('patient_id')
            .in('doctor_id', doctorIds),
          supabase.from('appointment_pricing').select('net_amount')
            .in('doctor_id', doctorIds).eq('payment_status', 'paid').gte('paid_at', monthStart),
          supabase.from('appointment_pricing').select('net_amount, id', { count: 'exact' })
            .in('doctor_id', doctorIds).eq('payment_status', 'pending'),
          supabase.from('prescriptions').select('id', { count: 'exact', head: true })
            .in('doctor_id', doctorIds).eq('is_printed', false),
        ])

        const uniquePatients = new Set((patients.data ?? []).map((a: { patient_id: string }) => a.patient_id)).size
        const revenue = (monthPricing.data ?? []).reduce((sum: number, r: { net_amount: number }) => sum + Number(r.net_amount), 0)
        const pendingAmt = (pendingPricing.data ?? []).reduce((sum: number, r: { net_amount: number }) => sum + Number(r.net_amount), 0)

        setStats({
          todayAppointments: apptToday.count ?? 0,
          completedToday: apptCompleted.count ?? 0,
          totalPatients: uniquePatients,
          monthRevenue: revenue,
          pendingPayments: pendingAmt,
          pendingPrescriptions: rxPending.count ?? 0,
        })
      } catch (e) {
        console.error('fetchStats error:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [profile, profileLoading])

  if (profileLoading || loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-slate-200 rounded" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-slate-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="icl p-6 sm:p-8 space-y-6">
      <div className="icl-fade-up">
        <h1 className="icl-hero">
          Welcome back, {profile?.full_name?.split(' ').slice(0, 2).join(' ')}
        </h1>
        <p className="icl-sub mt-1">{today}</p>
      </div>

      <div className="icl-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Today's Appointments"
          value={stats?.todayAppointments ?? 0}
          sub={`${stats?.completedToday ?? 0} completed`}
          icon={CalendarDays}
          color={{ bg: 'var(--icl-accent-soft)', fg: 'var(--icl-accent-dark)' }}
        />
        <StatCard
          title="Total Patients"
          value={stats?.totalPatients ?? 0}
          sub="across all appointments"
          icon={Users}
          color={{ bg: 'var(--icl-success-bg)', fg: 'var(--icl-success)' }}
        />
        <StatCard
          title="Revenue This Month"
          value={`SAR ${(stats?.monthRevenue ?? 0).toLocaleString()}`}
          sub="paid appointments"
          icon={TrendingUp}
          color={{ bg: 'var(--icl-brand-soft)', fg: 'var(--icl-brand-dark)' }}
        />
        <StatCard
          title="Pending Payments"
          value={`SAR ${(stats?.pendingPayments ?? 0).toLocaleString()}`}
          sub="awaiting collection"
          icon={DollarSign}
          color={{ bg: 'var(--icl-amber-bg)', fg: 'var(--icl-amber)' }}
        />
        <StatCard
          title="Unprinted Prescriptions"
          value={stats?.pendingPrescriptions ?? 0}
          sub="need to be printed"
          icon={FileText}
          color={{ bg: 'var(--icl-danger-bg)', fg: 'var(--icl-danger)' }}
        />
        <StatCard
          title="Completed Today"
          value={stats?.completedToday ?? 0}
          sub={`of ${stats?.todayAppointments ?? 0} scheduled`}
          icon={Clock}
          color={{ bg: '#EEF1F6', fg: 'var(--icl-muted)' }}
        />
      </div>
    </div>
  )
}
