import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Linking,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { getBilling, billingAction, type BillingInfo, type Payment } from '../../lib/doctorApi'
import { colors, radius, shadow, type } from '../../lib/theme'
import { Card, TopBar } from '../../components/ui'
import { DoctorAmbient, FadeInUp } from '../../components/motion'
import ReportPaymentForm from '../../components/ReportPaymentForm'

function money(n: number): string {
  return `$${Number(n).toFixed(2)}`
}

function longDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

const PAY_STATUS: Record<string, { bg: string; fg: string; label: string }> = {
  paid: { bg: colors.successBg, fg: '#0E7E58', label: 'Paid' },
  failed: { bg: colors.dangerBg, fg: '#B91C1C', label: 'Failed' },
  refunded: { bg: '#EEF0F4', fg: '#7A8496', label: 'Refunded' },
  pending: { bg: colors.amberBg, fg: colors.amber, label: 'Pending' },
}

const METHOD_LABEL: Record<string, string> = {
  card: 'Card', whish: 'Whish Money', omt: 'OMT',
  bank_transfer: 'Bank transfer', cash: 'Cash', manual: 'Manual', other: 'Other',
}

function PaymentRow({ p }: { p: Payment }) {
  const st = PAY_STATUS[p.status ?? 'paid'] ?? PAY_STATUS.paid
  const doc = p.receipt_url ?? p.invoice_url ?? null
  return (
    <View style={styles.payRow}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.payAmount}>{money(p.amount_usd)}</Text>
          <View style={{ backgroundColor: st.bg, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: st.fg, fontSize: 10.5, fontWeight: '800' }}>{st.label}</Text>
          </View>
        </View>
        <Text style={[type.sub, { marginTop: 3 }]}>
          {shortDate(p.created_at)} · {METHOD_LABEL[p.method] ?? p.method}
          {p.card_last4 ? ` ···· ${p.card_last4}` : ''}
        </Text>
        {p.failure_reason ? (
          <Text style={[type.sub, { marginTop: 3, color: colors.danger }]}>{p.failure_reason}</Text>
        ) : null}
        {p.reference ? (
          <Text style={[type.small, { marginTop: 2 }]}>Ref {p.reference}</Text>
        ) : null}
      </View>
      {doc ? (
        <Pressable onPress={() => Linking.openURL(doc)} hitSlop={8}
          style={({ pressed }) => [styles.receiptBtn, pressed && { backgroundColor: colors.docSoft }]}>
          <Feather name="download" size={14} color={colors.doc} />
        </Pressable>
      ) : null}
    </View>
  )
}

export default function DoctorBillingScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets()
  const [info, setInfo] = useState<BillingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState('m1')

  const load = useCallback(async () => {
    try { setInfo(await getBilling()); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load billing') }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function run(action: 'checkout' | 'portal' | 'cancel' | 'resume') {
    setBusy(action)
    setError('')
    try {
      const res = await billingAction(action, action === 'checkout' ? plan : undefined)
      if ((action === 'checkout' || action === 'portal')) {
        if (res.url) Linking.openURL(res.url)
        else setError('Card payment is not set up yet — use the transfer details below.')
      } else {
        setConfirmCancel(false)
        await load()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar title="Billing & payments" onBack={onBack} />
        <ActivityIndicator color={colors.doc} style={{ marginTop: 40 }} />
      </View>
    )
  }

  const sub = info?.subscription
  const access = info?.access
  const cap = info?.capabilities
  const inst = info?.instructions
  const isTrial = access?.is_trial ?? false
  const canceling = sub?.cancel_at_period_end ?? false

  const heading = isTrial ? 'Free trial'
    : access?.status === 'active' ? 'Subscription active'
    : access?.status === 'past_due' ? 'Payment overdue'
    : access?.status === 'canceled' ? 'Subscription canceled'
    : access?.has_access ? 'Subscription active'
    : 'No active subscription'

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <DoctorAmbient />
      <TopBar title="Billing & payments" onBack={onBack} />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom, 24) + 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Plan ─────────────────────────────────────────────────────────── */}
        <FadeInUp>
          <View style={styles.planCard}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planKicker}>{heading}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
                  <Text style={styles.planPrice}>{money(sub?.price_usd ?? access?.price_usd ?? 9.99)}</Text>
                  <Text style={styles.planPer}> / {sub?.plan === 'yearly' ? 'year' : 'month'}</Text>
                </View>
              </View>
              <View style={styles.planIcon}>
                <Feather name={isTrial ? 'gift' : access?.has_access ? 'check' : 'lock'} size={17} color="#fff" />
              </View>
            </View>

            <View style={styles.planDivider} />

            {isTrial ? (
              <Text style={styles.planLine}>
                {access?.days_left} day{access?.days_left === 1 ? '' : 's'} left · ends {longDate(sub?.trial_end ?? sub?.current_period_end)}
              </Text>
            ) : canceling ? (
              <Text style={styles.planLine}>
                Auto-renew is off · access ends {longDate(sub?.current_period_end)}
              </Text>
            ) : info?.next_charge ? (
              <Text style={styles.planLine}>
                Next charge {money(info.next_charge.amount_usd)} on {longDate(info.next_charge.date)}
              </Text>
            ) : (
              <Text style={styles.planLine}>
                {access?.has_access ? `Active until ${longDate(sub?.current_period_end)}` : 'Subscribe to appear in the patient app'}
              </Text>
            )}
          </View>
        </FadeInUp>

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={15} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── Payment method ───────────────────────────────────────────────── */}
        {info?.details_enabled ? (
          <FadeInUp delay={70}>
            <Card style={{ marginTop: 16 }}>
              <Text style={type.label}>Payment method</Text>
              {info.card ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
                  <View style={styles.cardIcon}>
                    <MaterialCommunityIcons name="credit-card-outline" size={19} color={colors.doc} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={type.h2}>
                      {info.card.brand ?? 'Card'} ···· {info.card.last4}
                    </Text>
                    {info.card.exp_month && info.card.exp_year ? (
                      <Text style={[type.sub, { marginTop: 2 }]}>
                        Expires {String(info.card.exp_month).padStart(2, '0')}/{String(info.card.exp_year).slice(-2)}
                      </Text>
                    ) : null}
                  </View>
                  {cap?.can_self_serve ? (
                    <Pressable onPress={() => run('portal')} hitSlop={8}>
                      <Text style={styles.linkText}>{busy === 'portal' ? '…' : 'Change'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
                  <View style={styles.cardIconMuted}>
                    <MaterialCommunityIcons name="credit-card-off-outline" size={19} color={colors.textFaint} />
                  </View>
                  <Text style={[type.sub, { flex: 1 }]}>
                    No card saved. Payments so far have been recorded manually.
                  </Text>
                </View>
              )}
            </Card>
          </FadeInUp>
        ) : null}

        {/* ── Actions ──────────────────────────────────────────────────────── */}
        <FadeInUp delay={110}>
          {cap?.can_pay_by_card ? (
            <>
              {info?.plans?.length && !cap.recurring ? (
                <View style={{ marginTop: 20 }}>
                  <Text style={[type.label, { marginBottom: 10 }]}>Choose how long to pay for</Text>
                  {info.plans.map((p) => {
                    const active = p.key === plan
                    return (
                      <Pressable key={p.key} onPress={() => setPlan(p.key)}
                        style={[styles.planRow, active && styles.planRowActive]}>
                        <View style={[styles.radio, active && styles.radioOn]}>
                          {active ? <View style={styles.radioDot} /> : null}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={type.h2}>{p.label}</Text>
                          <Text style={[type.sub, { marginTop: 1 }]}>
                            {money(p.amount_usd / p.months)} per month
                          </Text>
                        </View>
                        {p.save_pct > 0 ? (
                          <View style={styles.saveBadge}>
                            <Text style={styles.saveText}>Save {p.save_pct}%</Text>
                          </View>
                        ) : null}
                        <Text style={styles.planAmount}>{money(p.amount_usd)}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              ) : null}

              {cap.test_mode ? (
                <View style={styles.testBox}>
                  <Feather name="alert-triangle" size={14} color={colors.amber} />
                  <Text style={styles.testText}>Test mode — no real money will be charged.</Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => run('checkout')}
                disabled={busy === 'checkout'}
                style={({ pressed }) => [styles.payBtn, pressed && { backgroundColor: colors.docDark }]}
              >
                {busy === 'checkout' ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Feather name="credit-card" size={18} color="#fff" />
                    <Text style={styles.payBtnText}>
                      {cap.recurring ? 'Subscribe by card' : 'Pay by card'}
                    </Text>
                  </>
                )}
              </Pressable>
              <Text style={styles.cardNote}>
                {cap.recurring
                  ? 'Visa, Mastercard, Amex, Apple Pay and Google Pay. Renews automatically each month — cancel any time.'
                  : 'Works with any Visa or Mastercard, including the free virtual Visa card in the Whish app.'}
              </Text>
            </>
          ) : null}

          {sub ? (
            canceling ? (
              <Pressable
                onPress={() => run('resume')}
                disabled={busy === 'resume'}
                style={({ pressed }) => [styles.ghostBtn, pressed && { backgroundColor: colors.docSofter }]}
              >
                {busy === 'resume'
                  ? <ActivityIndicator size="small" color={colors.doc} />
                  : <Text style={styles.ghostText}>Turn auto-renew back on</Text>}
              </Pressable>
            ) : confirmCancel ? (
              <View style={styles.confirmBox}>
                <Text style={[type.sub, { textAlign: 'center' }]}>
                  Auto-renew stops and you keep access until {longDate(sub.current_period_end)}. After that
                  patients will no longer see you.
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <Pressable onPress={() => setConfirmCancel(false)}
                    style={({ pressed }) => [styles.confirmKeep, pressed && { opacity: 0.7 }]}>
                    <Text style={styles.confirmKeepText}>Keep it</Text>
                  </Pressable>
                  <Pressable onPress={() => run('cancel')} disabled={busy === 'cancel'}
                    style={({ pressed }) => [styles.confirmGo, pressed && { opacity: 0.8 }]}>
                    {busy === 'cancel'
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.confirmGoText}>Cancel renewal</Text>}
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setConfirmCancel(true)} style={styles.cancelLink}>
                <Text style={styles.cancelLinkText}>Cancel subscription</Text>
              </Pressable>
            )
          ) : null}
        </FadeInUp>

        {/* ── How to pay (manual rails) ────────────────────────────────────── */}
        {inst?.whish || inst?.omt || inst?.bank ? (
          <FadeInUp delay={150}>
            <Card style={{ marginTop: 16 }}>
              <Text style={type.h2}>Other ways to pay</Text>
              <View style={{ marginTop: 12, gap: 12 }}>
                {inst.whish ? <PayRow icon="smartphone" label="Whish Money" value={inst.whish} /> : null}
                {inst.omt ? <PayRow icon="map-pin" label="OMT" value={inst.omt} /> : null}
                {inst.bank ? <PayRow icon="home" label="Bank transfer" value={inst.bank} /> : null}
              </View>
              <Text style={[type.sub, { marginTop: 14 }]}>{inst.note}</Text>
              {inst.contact ? (
                <Pressable
                  onPress={() => Linking.openURL(`https://wa.me/${inst.contact?.replace(/[^0-9]/g, '')}`)}
                  style={({ pressed }) => [styles.contactBtn, pressed && { backgroundColor: colors.docSoft }]}
                >
                  <Feather name="message-circle" size={16} color={colors.doc} />
                  <Text style={styles.contactText}>Send receipt: {inst.contact}</Text>
                </Pressable>
              ) : null}

              <ReportPaymentForm plans={info?.plans ?? []} onDone={load} />
            </Card>
          </FadeInUp>
        ) : null}

        {/* ── History ──────────────────────────────────────────────────────── */}
        <FadeInUp delay={190}>
          <Text style={[type.h2, { marginTop: 26, marginBottom: 12 }]}>Billing history</Text>
          {(info?.payments.length ?? 0) === 0 ? (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.cardIconMuted}>
                  <Feather name="file-text" size={17} color={colors.textFaint} />
                </View>
                <Text style={[type.sub, { flex: 1 }]}>
                  No payments yet. Anything you pay will show up here with a receipt.
                </Text>
              </View>
            </Card>
          ) : (
            <Card style={{ paddingVertical: 4 }}>
              {info!.payments.map((p, i) => (
                <View key={p.id ?? `${p.created_at}-${i}`}>
                  {i > 0 ? <View style={styles.sep} /> : null}
                  <PaymentRow p={p} />
                </View>
              ))}
            </Card>
          )}
        </FadeInUp>
      </ScrollView>
    </View>
  )
}

function PayRow({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}>
      <View style={styles.payIcon}><Feather name={icon} size={15} color={colors.doc} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: '600' }}>{label}</Text>
        <Text style={{ fontSize: 15, color: colors.ink, fontWeight: '700', marginTop: 1 }}>{value}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  planCard: { backgroundColor: colors.doc, borderRadius: radius.xl, padding: 20, ...shadow.raised },
  planKicker: { color: 'rgba(255,255,255,0.78)', fontSize: 12.5, fontWeight: '700' },
  planPrice: { fontSize: 34, fontWeight: '800', color: '#fff', letterSpacing: -0.8 },
  planPer: { fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  planIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  planDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.28)', marginVertical: 14 },
  planLine: { color: 'rgba(255,255,255,0.94)', fontSize: 13.5, lineHeight: 19.5 },
  cardIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.docSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  cardIconMuted: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  linkText: { color: colors.doc, fontWeight: '800', fontSize: 13.5 },
  planRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card,
    borderRadius: radius.md, padding: 14, marginBottom: 9,
    borderWidth: 1.5, borderColor: colors.border,
  },
  planRowActive: { borderColor: colors.doc, backgroundColor: colors.docSofter },
  radio: {
    width: 21, height: 21, borderRadius: 11, borderWidth: 2, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: colors.doc },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.doc },
  planAmount: { fontSize: 16, fontWeight: '800', color: colors.ink },
  saveBadge: { backgroundColor: colors.successBg, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  saveText: { color: '#0E7E58', fontSize: 10.5, fontWeight: '800' },
  testBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 2,
    backgroundColor: colors.amberBg, borderRadius: radius.sm, padding: 10,
  },
  testText: { flex: 1, color: colors.amber, fontSize: 12.5, fontWeight: '700' },
  cardNote: { ...type.small, textAlign: 'center', marginTop: 10, lineHeight: 17 },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    backgroundColor: colors.doc, borderRadius: radius.md, paddingVertical: 15, marginTop: 16, minHeight: 52,
  },
  payBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  ghostBtn: {
    alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingVertical: 14,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.docSoft, backgroundColor: colors.card,
    minHeight: 50,
  },
  ghostText: { color: colors.doc, fontWeight: '800', fontSize: 15 },
  cancelLink: { alignSelf: 'center', marginTop: 18, paddingVertical: 8 },
  cancelLinkText: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
  confirmBox: {
    marginTop: 16, backgroundColor: colors.card, borderRadius: radius.lg, padding: 16,
    borderWidth: 1.5, borderColor: colors.border,
  },
  confirmKeep: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  confirmKeepText: { color: colors.text, fontWeight: '800', fontSize: 14 },
  confirmGo: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
    borderRadius: radius.md, backgroundColor: colors.danger, minHeight: 44,
  },
  confirmGoText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  payIcon: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.docSofter,
    alignItems: 'center', justifyContent: 'center',
  },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 16, paddingVertical: 12, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.docSoft,
  },
  contactText: { color: colors.doc, fontWeight: '700', fontSize: 14 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 2 },
  payAmount: { fontSize: 16, fontWeight: '800', color: colors.ink },
  receiptBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.docSoft,
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14,
    backgroundColor: colors.dangerBg, borderRadius: radius.sm, padding: 11,
    borderWidth: 1, borderColor: '#F6C9C9',
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: '600', lineHeight: 18 },
})
