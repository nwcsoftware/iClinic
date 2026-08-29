'use client'

import { Stethoscope, Building2, ChevronDown, Check } from 'lucide-react'
import { useState } from 'react'
import type { SecretaryDoctor, SecretaryLocation } from '@/hooks/useSecretary'

// ---------------------------------------------------------------------------
// Whose diary am I looking at, and where?
//
// Kept at the top of every secretary screen and never collapsed. A secretary
// working for two doctors is one careless click away from moving the wrong
// person's Tuesday, so the answer is always on screen rather than implied by
// whatever was last tapped.
//
// The doctor control disappears entirely when there is only one, because a
// menu with a single option is furniture.
// ---------------------------------------------------------------------------

export default function ContextBar({
  doctors, activeDoctorId, onSwitchDoctor,
  locations, activeLocationId, onSwitchLocation,
}: {
  doctors: SecretaryDoctor[]
  activeDoctorId: string | null
  onSwitchDoctor: (id: string) => void
  locations: SecretaryLocation[]
  /** null means "every location I am allowed to see". */
  activeLocationId: string | null
  onSwitchLocation: (id: string | null) => void
}) {
  const [openDoctors, setOpenDoctors] = useState(false)
  const [openPlaces, setOpenPlaces] = useState(false)

  const doctor = doctors.find((d) => d.doctor_id === activeDoctorId)
  const place = locations.find((l) => l.location_id === activeLocationId)

  return (
    <div
      className="icl sticky top-0 z-30 flex flex-wrap items-center gap-2 px-5 py-3 sm:px-8"
      style={{ background: 'var(--icl-card)', borderBottom: '1px solid var(--icl-border)' }}
    >
      {/* Doctor */}
      {doctors.length > 1 ? (
        <Picker
          open={openDoctors}
          setOpen={(v) => { setOpenDoctors(v); if (v) setOpenPlaces(false) }}
          icon={<Stethoscope className="h-4 w-4" style={{ color: 'var(--icl-doc)' }} />}
          label={doctor?.full_name ?? 'Choose a doctor'}
          sub={doctor?.specialty ?? undefined}
        >
          {doctors.map((d) => (
            <Option
              key={d.doctor_id}
              selected={d.doctor_id === activeDoctorId}
              title={d.full_name}
              sub={d.specialty ?? undefined}
              onClick={() => { onSwitchDoctor(d.doctor_id); setOpenDoctors(false) }}
            />
          ))}
        </Picker>
      ) : (
        <Static
          icon={<Stethoscope className="h-4 w-4" style={{ color: 'var(--icl-doc)' }} />}
          label={doctor?.full_name ?? 'No doctor'}
          sub={doctor?.specialty ?? undefined}
        />
      )}

      {/* Location */}
      <Picker
        open={openPlaces}
        setOpen={(v) => { setOpenPlaces(v); if (v) setOpenDoctors(false) }}
        icon={<Building2 className="h-4 w-4" style={{ color: 'var(--icl-accent)' }} />}
        label={place?.name ?? 'All my locations'}
        sub={place?.city ?? (locations.length > 1 ? `${locations.length} places` : undefined)}
      >
        <Option
          selected={activeLocationId === null}
          title="All my locations"
          sub={`${locations.length} place${locations.length === 1 ? '' : 's'}`}
          onClick={() => { onSwitchLocation(null); setOpenPlaces(false) }}
        />
        {locations.map((l) => (
          <Option
            key={l.location_id}
            selected={l.location_id === activeLocationId}
            title={l.name}
            sub={l.city ?? undefined}
            onClick={() => { onSwitchLocation(l.location_id); setOpenPlaces(false) }}
          />
        ))}
      </Picker>
    </div>
  )
}

function Picker({
  open, setOpen, icon, label, sub, children,
}: {
  open: boolean
  setOpen: (v: boolean) => void
  icon: React.ReactNode
  label: string
  sub?: string
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 px-3 py-2 transition-colors"
        style={{
          border: '1.5px solid var(--icl-border)',
          borderRadius: 'var(--icl-r-full)',
          background: open ? 'var(--icl-accent-softer)' : 'var(--icl-card)',
        }}
      >
        {icon}
        <span className="text-left">
          <span className="block" style={{ fontSize: 14, fontWeight: 700, color: 'var(--icl-ink)' }}>{label}</span>
          {sub ? <span className="icl-small block leading-tight">{sub}</span> : null}
        </span>
        <ChevronDown className="h-4 w-4" style={{ color: 'var(--icl-faint)' }} />
      </button>

      {open ? (
        <>
          {/* Catches the click that closes it, so the menu never sticks open. */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 z-20 mt-2 w-64 overflow-hidden p-1"
            style={{
              background: 'var(--icl-card)',
              border: '1px solid var(--icl-border)',
              borderRadius: 'var(--icl-r-lg)',
              boxShadow: 'var(--icl-shadow-raised)',
            }}
          >
            {children}
          </div>
        </>
      ) : null}
    </div>
  )
}

function Static({ icon, label, sub }: { icon: React.ReactNode; label: string; sub?: string }) {
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2"
      style={{ border: '1.5px solid var(--icl-border)', borderRadius: 'var(--icl-r-full)' }}
    >
      {icon}
      <span className="text-left">
        <span className="block" style={{ fontSize: 14, fontWeight: 700, color: 'var(--icl-ink)' }}>{label}</span>
        {sub ? <span className="icl-small block leading-tight">{sub}</span> : null}
      </span>
    </div>
  )
}

function Option({
  selected, title, sub, onClick,
}: { selected: boolean; title: string; sub?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[var(--icl-accent-softer)]"
      style={{ borderRadius: 'var(--icl-r-md)' }}
    >
      <span className="flex-1">
        <span className="block" style={{ fontSize: 14, fontWeight: 600, color: 'var(--icl-ink)' }}>{title}</span>
        {sub ? <span className="icl-small block">{sub}</span> : null}
      </span>
      {selected ? <Check className="h-4 w-4" style={{ color: 'var(--icl-accent)' }} /> : null}
    </button>
  )
}
