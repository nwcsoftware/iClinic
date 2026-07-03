import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Platform, Switch,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import {
  getDoctorSchedule, updateWeekday, toggleDayOff,
  type Availability, type TimeOff,
} from '../../lib/doctorApi'
import { colors, radius, type } from '../../lib/theme'
import { Card } from '../../components/ui'
import { DoctorAmbient, FadeInUp } from '../../components/motion'
import { notify } from '../../lib/notify'

const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WD_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DoctorScheduleScreen() {
  const insets = useSafeAreaInsets()
  const [availability, setAvailability] = useState<Availability[]>([])
  const [timeOff, setTimeOff] = useState<TimeOff[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [editing, setEditing] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const s = await getDoctorSchedule()
      setAvailability(s.availability)
      setTimeOff(s.time_off)
    } catch { /* retried on next action */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const byDay = new Map(availability.map((a) => [a.weekday, a]))
  const offSet = new Set(timeOff.map((t) => t.off_date))
  const next14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i)
    return d
  })

  async function onToggleDay(weekday: number, value: boolean) {
    setSavingKey(`wd-${weekday}`)
    try {
      await updateWeekday({ weekday, is_active: value })
      await load()
    } catch (e) { notify('Could not save', e instanceof Error ? e.message : undefined) }
    finally { setSavingKey(null) }
  }

  async function onSetHour(weekday: number, field: 'start_time' | 'end_time', value: string) {
    setSavingKey(`wd-${weekday}`)
    try {
      await updateWeekday({ weekday, [field]: value })
      await load()
    } catch (e) { notify('Could not save', e instanceof Error ? e.message : undefined) }
    finally { setSavingKey(null) }
  }

  async function onToggleDate(date: string) {
    setSavingKey(`d-${date}`)
    try {
      await toggleDayOff(date)
      await load()
    } catch (e) { notify('Could not save', e instanceof Error ? e.message : undefined) }
    finally { setSavingKey(null) }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <DoctorAmbient />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 20 : 14) + 8, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <FadeInUp>
          <Text style={type.h1}>My schedule</Text>
          <Text style={[type.sub, { marginTop: 4 }]}>Patients can only book the days and hours you open here.</Text>
        </FadeInUp>

        {loading ? (
          <ActivityIndicator color={colors.doc} style={{ marginTop: 48 }} />
        ) : (
          <>
            {/* Specific days off */}
            <FadeInUp delay={70}>
              <Text style={[type.h2, { marginTop: 24, marginBottom: 10 }]}>Next two weeks</Text>
              <Text style={[type.sub, { marginBottom: 12 }]}>Tap a day to block or unblock it.</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingVertical: 2 }}>
                {next14.map((d) => {
                  const key = ymd(d)
                  const blocked = offSet.has(key)
                  const saving = savingKey === `d-${key}`
                  return (
                    <Pressable key={key} onPress={() => onToggleDate(key)} disabled={saving}
                      style={[styles.dayChip, blocked && styles.dayChipBlocked]}>
                      {saving ? <ActivityIndicator size="small" color={blocked ? '#fff' : colors.doc} /> : (
                        <>
                          <Text style={[styles.dayWd, blocked && { color: 'rgba(255,255,255,0.85)' }]}>{WD_SHORT[d.getDay()]}</Text>
                          <Text style={[styles.dayNum, blocked && { color: '#fff' }]}>{d.getDate()}</Text>
                          <Text style={[styles.dayState, blocked && { color: '#fff' }]}>{blocked ? 'Off' : 'Open'}</Text>
                        </>
                      )}
                    </Pressable>
                  )
                })}
              </ScrollView>
            </FadeInUp>

            {/* Weekly hours */}
            <FadeInUp delay={140}>
              <Text style={[type.h2, { marginTop: 28, marginBottom: 12 }]}>Weekly hours</Text>
              {WD.map((name, wd) => {
                const row = byDay.get(wd)
                const active = row?.is_active ?? false
                const saving = savingKey === `wd-${wd}`
                const isEditing = editing === wd
                return (
                  <Card key={wd} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={type.h2}>{name}</Text>
                        <Text style={[type.sub, { marginTop: 2 }]}>
                          {active && row ? `${row.start_time.slice(0, 5)} – ${row.end_time.slice(0, 5)}` : 'Not working'}
                        </Text>
                      </View>
                      {active && (
                        <Pressable onPress={() => setEditing(isEditing ? null : wd)} hitSlop={8} style={styles.editHours}>
                          <Feather name={isEditing ? 'chevron-up' : 'clock'} size={16} color={colors.doc} />
                        </Pressable>
                      )}
                      {saving
                        ? <ActivityIndicator size="small" color={colors.doc} />
                        : <Switch
                            value={active}
                            onValueChange={(v) => onToggleDay(wd, v)}
                            trackColor={{ false: '#D8DDE6', true: colors.docSoft }}
                            thumbColor={active ? colors.doc : '#f4f4f5'}
                          />}
                    </View>

                    {isEditing && active && row && (
                      <View style={{ marginTop: 14, gap: 12 }}>
                        {(['start_time', 'end_time'] as const).map((field) => (
                          <View key={field}>
                            <Text style={[type.label, { marginBottom: 8 }]}>{field === 'start_time' ? 'Starts' : 'Ends'}</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
                              {HOURS.map((h) => {
                                const selected = row[field].slice(0, 5) === h
                                return (
                                  <Pressable key={h} onPress={() => onSetHour(wd, field, h)}
                                    style={[styles.hourChip, selected && styles.hourChipActive]}>
                                    <Text style={[styles.hourText, selected && { color: '#fff' }]}>{h}</Text>
                                  </Pressable>
                                )
                              })}
                            </ScrollView>
                          </View>
                        ))}
                      </View>
                    )}
                  </Card>
                )
              })}
            </FadeInUp>
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  dayChip: {
    width: 62, height: 82, borderRadius: radius.md, backgroundColor: colors.card,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 1,
  },
  dayChipBlocked: { backgroundColor: '#B4544B', borderColor: '#B4544B' },
  dayWd: { fontSize: 11.5, color: colors.textMuted, fontWeight: '600' },
  dayNum: { fontSize: 19, color: colors.ink, fontWeight: '800' },
  dayState: { fontSize: 10.5, color: colors.doc, fontWeight: '700' },
  editHours: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.docSofter,
    alignItems: 'center', justifyContent: 'center',
  },
  hourChip: {
    borderRadius: radius.full, paddingHorizontal: 13, paddingVertical: 8,
    backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border,
  },
  hourChipActive: { backgroundColor: colors.doc, borderColor: colors.doc },
  hourText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
})
