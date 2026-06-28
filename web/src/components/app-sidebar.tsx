'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Profile } from '@/types'
import {
  LayoutDashboard, Users, CalendarDays, FileText,
  DollarSign, Settings, LogOut, Stethoscope, ClipboardList
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'

const doctorNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/patients', label: 'Patients', icon: Users },
  { href: '/appointments', label: 'Appointments', icon: CalendarDays },
  { href: '/prescriptions', label: 'Prescriptions', icon: FileText },
  { href: '/finances', label: 'Finances', icon: DollarSign },
]

const receptionistNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/appointments', label: 'Appointments', icon: CalendarDays },
  { href: '/prescriptions', label: 'Prescriptions', icon: FileText },
  { href: '/finances', label: 'Finances', icon: DollarSign },
]

export default function AppSidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const nav = profile.role === 'doctor' ? doctorNav : receptionistNav

  return (
    <aside className="w-64 shrink-0 flex flex-col bg-white border-r border-slate-200 h-screen">
      {/* Brand */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <Stethoscope className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate text-sm">Clinic System</p>
            <p className="text-xs text-slate-400 truncate capitalize">{profile.role === 'receptionist' ? 'Doctor Assistant' : profile.role}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}

        <div className="pt-2 mt-2 border-t border-slate-100">
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname.startsWith('/settings')
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            <Settings className="w-4 h-4 shrink-0" />
            Settings
          </Link>
        </div>
      </nav>

      {/* User info */}
      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
            <ClipboardList className="w-4 h-4 text-slate-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{profile.full_name}</p>
            {profile.specialty && (
              <p className="text-xs text-slate-400 truncate">{profile.specialty}</p>
            )}
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
