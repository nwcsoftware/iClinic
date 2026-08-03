import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Animated, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import {
  triage, getTriageHistory, closeTriageSession, type ChatMessage, type Doctor,
} from '../lib/api'
import { colors, radius, shadow, type } from '../lib/theme'
import { useI18n } from '../lib/i18n'
import { Avatar, Rating, TopBar } from '../components/ui'
import { FadeInUp } from '../components/motion'
import { getCountry, loadSavedCountry, dial } from '../lib/emergency'

type Bubble = ChatMessage & { id: number }

const SUGGESTION_KEYS = ['chat.s1', 'chat.s2', 'chat.s3', 'chat.s4', 'chat.s5', 'chat.s6'] as const

function TypingDots() {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current]
  useEffect(() => {
    const anims = dots.map((v, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 160),
        Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: false }),
        Animated.timing(v, { toValue: 0.3, duration: 320, useNativeDriver: false }),
        Animated.delay((2 - i) * 160),
      ])))
    anims.forEach((a) => a.start())
    return () => anims.forEach((a) => a.stop())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 4 }}>
      {dots.map((v, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.textFaint, opacity: v }} />
      ))}
    </View>
  )
}

let bubbleId = 1

export default function TriageScreen({
  onBack, onPickDoctor,
}: {
  onBack: () => void
  onPickDoctor: (doctor: Doctor, summary: string) => void
}) {
  const insets = useSafeAreaInsets()
  const { t, lang } = useI18n()
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState(true)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [summary, setSummary] = useState('')
  const [emergency, setEmergency] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [countryCode, setCountryCode] = useState('LB')
  const scrollRef = useRef<ScrollView>(null)
  const history = useRef<ChatMessage[]>([])
  const sessionId = useRef<string | null>(null)

  useEffect(() => { loadSavedCountry().then(setCountryCode) }, [])

  function scrollDown(animated = true) {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated }), 60)
  }

  // Restore the saved conversation on open.
  useEffect(() => {
    let active = true
    getTriageHistory()
      .then((h) => {
        if (!active) return
        if (h.messages.length > 0) {
          sessionId.current = h.session_id
          history.current = h.messages
          setBubbles(h.messages.map((m) => ({ ...m, id: bubbleId++ })))
          setDoctors(h.doctors ?? [])
          setSummary(h.summary ?? '')
          setShowSuggestions(false)
          scrollDown(false)
        } else {
          setBubbles([{ id: 0, role: 'assistant', content: t('chat.greeting') }])
        }
      })
      .catch(() => { if (active) setBubbles([{ id: 0, role: 'assistant', content: t('chat.greeting') }]) })
      .finally(() => { if (active) setRestoring(false) })
    return () => { active = false }
  }, [])

  async function startNewChat() {
    if (loading) return
    try { await closeTriageSession() } catch { /* history stays, UI resets anyway */ }
    sessionId.current = null
    history.current = []
    setBubbles([{ id: bubbleId++, role: 'assistant', content: t('chat.greeting') }])
    setDoctors([])
    setSummary('')
    setEmergency(false)
    setShowSuggestions(true)
  }

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')
    setShowSuggestions(false)
    setDoctors([])

    setBubbles((b) => [...b, { id: bubbleId++, role: 'user', content: msg }])
    history.current = [...history.current, { role: 'user', content: msg }]
    setLoading(true)
    scrollDown()

    try {
      const res = await triage(history.current, sessionId.current, lang)
      sessionId.current = res.session_id ?? sessionId.current
      setBubbles((b) => [...b, { id: bubbleId++, role: 'assistant', content: res.reply }])
      history.current = [...history.current, { role: 'assistant', content: res.reply }]
      setEmergency(res.emergency)
      if (res.ready && res.doctors.length > 0) {
        setDoctors(res.doctors)
        setSummary(res.summary)
      }
    } catch (e) {
      setBubbles((b) => [...b, {
        id: bubbleId++, role: 'assistant',
        content: `${t('chat.unreachable')} ${e instanceof Error ? e.message : ''}`,
      }])
    } finally {
      setLoading(false)
      scrollDown()
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar
        title={t('chat.title')}
        onBack={onBack}
        right={
          <Pressable onPress={startNewChat} hitSlop={10}>
            <Feather name="edit" size={18} color={colors.brand} />
          </Pressable>
        }
      />

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
        {restoring ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 32 }} />
        ) : (
          <>
            {bubbles.map((b) => (
              <View key={b.id} style={[styles.row, b.role === 'user' && { justifyContent: 'flex-end' }]}>
                {b.role === 'assistant' && (
                  <View style={styles.botAvatar}>
                    <MaterialCommunityIcons name="stethoscope" size={16} color={colors.brand} />
                  </View>
                )}
                <View style={[styles.bubble, b.role === 'user' ? styles.userBubble : styles.botBubble]}>
                  <Text style={b.role === 'user' ? styles.userText : styles.botText}>{b.content}</Text>
                </View>
              </View>
            ))}

            {loading && (
              <View style={styles.row}>
                <View style={styles.botAvatar}>
                  <MaterialCommunityIcons name="stethoscope" size={16} color={colors.brand} />
                </View>
                <View style={[styles.bubble, styles.botBubble]}><TypingDots /></View>
              </View>
            )}

            {showSuggestions && !loading && (
              <FadeInUp delay={200}>
                <Text style={[type.small, { marginLeft: 4, marginBottom: 8 }]}>{t('chat.common')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {SUGGESTION_KEYS.map((k) => t(k)).map((s) => (
                    <Pressable key={s} onPress={() => send(s)}
                      style={({ pressed }) => [styles.suggestion, pressed && { backgroundColor: colors.brandSoft, borderColor: colors.brandSoft }]}>
                      <Text style={styles.suggestionText}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              </FadeInUp>
            )}

            {emergency && (
              <FadeInUp>
                <View style={styles.emergency}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Feather name="alert-triangle" size={16} color={colors.danger} style={{ marginTop: 1 }} />
                    <Text style={styles.emergencyText}>
                      {t('chat.emergency')}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => dial(getCountry(countryCode).services[0].number)}
                    style={({ pressed }) => [styles.emergencyCallBtn, pressed && { backgroundColor: '#B91C1C' }]}
                  >
                    <Feather name="phone" size={15} color="#fff" />
                    <Text style={styles.emergencyCallText}>
                      {t('emergency.callNow', { number: getCountry(countryCode).services[0].number })}
                    </Text>
                  </Pressable>
                </View>
              </FadeInUp>
            )}

            {doctors.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={[type.label, { marginBottom: 10, marginLeft: 4 }]}>{t('chat.recommended')}</Text>
                {doctors.map((d, i) => (
                  <FadeInUp key={d.id} delay={i * 90}>
                    <View style={styles.docCard}>
                      <Avatar name={d.full_name} size={48} />
                      <View style={{ flex: 1 }}>
                        <Text style={type.h2} numberOfLines={1}>{d.full_name}</Text>
                        <Text style={[type.sub, { marginTop: 1 }]}>{d.specialty_name ?? d.specialty ?? t('common.specialist')}</Text>
                        <View style={{ marginTop: 3 }}><Rating rating={d.rating} count={d.review_count} /></View>
                      </View>
                      <Pressable onPress={() => onPickDoctor(d, summary)}
                        style={({ pressed }) => [styles.bookBtn, pressed && { backgroundColor: colors.brandDark }]}>
                        <Text style={styles.bookBtnText}>{t('common.book')}</Text>
                      </Pressable>
                    </View>
                  </FadeInUp>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={styles.input}
          placeholder={t('chat.placeholder')}
          placeholderTextColor={colors.textFaint}
          value={input}
          onChangeText={setInput}
          multiline
          onSubmitEditing={() => send()}
        />
        <Pressable
          onPress={() => send()}
          disabled={!input.trim() || loading}
          style={({ pressed }) => [styles.sendBtn, pressed && { backgroundColor: colors.brandDark }, (!input.trim() || loading) && { opacity: 0.35 }]}
        >
          <Feather name="arrow-up" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
  botAvatar: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingVertical: 11, paddingHorizontal: 15 },
  userBubble: { backgroundColor: colors.bubbleUser, borderBottomRightRadius: 6 },
  botBubble: {
    backgroundColor: colors.card, borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadow.card,
  },
  userText: { color: '#fff', fontSize: 15, lineHeight: 21.5 },
  botText: { color: colors.text, fontSize: 15, lineHeight: 21.5 },
  suggestion: {
    backgroundColor: colors.card, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1.5, borderColor: colors.border,
  },
  suggestionText: { fontSize: 13.5, color: colors.text, fontWeight: '600' },
  emergency: {
    backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: '#F6C9C9',
    borderRadius: radius.md, padding: 13, marginTop: 6, marginBottom: 8,
  },
  emergencyText: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  emergencyCallBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.danger, borderRadius: radius.sm, paddingVertical: 10, marginTop: 10,
  },
  emergencyCallText: { color: '#fff', fontWeight: '800', fontSize: 13.5 },
  docCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.lg,
    padding: 14, marginBottom: 10, ...shadow.card,
  },
  bookBtn: { backgroundColor: colors.brand, borderRadius: radius.full, paddingVertical: 10, paddingHorizontal: 18 },
  bookBtnText: { color: '#fff', fontWeight: '800', fontSize: 13.5 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 14, paddingTop: 10,
    backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  input: {
    flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 22, paddingHorizontal: 16,
    paddingTop: 11, paddingBottom: 11, fontSize: 15, maxHeight: 110, color: colors.ink, backgroundColor: '#FAFBFD',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
  },
})
