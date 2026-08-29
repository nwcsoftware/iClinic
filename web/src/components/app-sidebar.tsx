'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Profile } from '@/types'
import { LayoutDashboard, Users, CalendarDays, FileText, DollarSign, Settings, LogOut, Stethoscope, ClipboardList, UserCog, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'

const doctorNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/patients', label: 'Patients', icon: Users },
  { href: '/appointments', label: 'Appointments', icon: CalendarDays },
  { href: '/prescriptions', label: 'Prescriptions', icon: FileText },
  { href: '/finances', label: 'Finances', icon: DollarSign },
  { href: '/secretaries', label: 'Secretaries', icon: UserCog },
]

// A secretary runs the diary, not the medicine. Prescriptions, patient records
// and finances are gone from here entirely rather than shown and disabled: an
// action that is never theirs to take should not be somewhere they can see it,
// and the routes reject them regardless of what the sidebar draws.
const secretaryNav = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/appointments', label: 'Appointments', icon: CalendarDays },
  { href: '/schedule', label: 'Schedule', icon: Clock },
]

export default function AppSidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const nav = profile.role === 'doctor' ? doctorNav : secretaryNav

  return (
    <aside
      className="w-64 shrink-0 flex flex-col h-screen"
      style={{ background: 'var(--icl-card)', borderRight: '1px solid var(--icl-border)' }}
    >
      {/* Brand */}
      <div className="p-5" style={{ borderBottom: '1px solid var(--icl-border)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 flex items-center justify-center shrink-0"
            style={{ background: 'var(--icl-accent)', borderRadius: 12 }}
          >
            <Stethoscope className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate" style={{ fontSize: 15, fontWeight: 800, color: 'var(--icl-ink)', letterSpacing: '-0.2px' }}>iClinic</p>
            <p className="icl-small truncate capitalize">{profile.role === 'receptionist' ? 'Secretary' : profile.role}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }, i) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="icl-fade-up flex items-center gap-3 px-3 py-2.5 transition-colors"
              style={{
                // Staggered the way the app's lists arrive, one after another
                // rather than all at once.
                '--icl-delay': `${i * 45}ms`,
                borderRadius: 'var(--icl-r-md)',
                fontSize: 14, fontWeight: active ? 800 : 600,
                background: active ? 'var(--icl-accent-soft)' : 'transparent',
                color: active ? 'var(--icl-accent-dark)' : 'var(--icl-muted)',
              } as React.CSSProperties}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}

        <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--icl-border)' }}>
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 transition-colors"
            style={{
              borderRadius: 'var(--icl-r-md)',
              fontSize: 14, fontWeight: pathname.startsWith('/settings') ? 800 : 600,
              background: pathname.startsWith('/settings') ? 'var(--icl-accent-soft)' : 'transparent',
              color: pathname.startsWith('/settings') ? 'var(--icl-accent-dark)' : 'var(--icl-muted)',
            }}
          >
            <Settings className="w-4 h-4 shrink-0" />
            Settings
          </Link>
        </div>
      </nav>

      {/* User info */}
      <div className="p-4" style={{ borderTop: '1px solid var(--icl-border)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'var(--icl-accent-soft)' }}
          >
            <ClipboardList className="w-4 h-4" style={{ color: 'var(--icl-accent-dark)' }} />
          </div>
          <div className="min-w-0">
            <p className="truncate" style={{ fontSize: 14, fontWeight: 700, color: 'var(--icl-ink)' }}>{profile.full_name}</p>
            {profile.specialty && <p className="icl-small truncate">{profile.specialty}</p>}
          </div>
        </div>
        <form action="/api/auth/signout" method="POST">
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-slate-500 hover:text-red-600 hover:bg-red-50 gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  )
}
