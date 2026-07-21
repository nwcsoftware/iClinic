import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { I18nManager, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type Lang = 'en' | 'fr' | 'ar'

export const LANGUAGES: { code: Lang; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'ar', label: 'Arabic', native: 'العربية' },
]

export const LOCALES: Record<Lang, string> = { en: 'en-US', fr: 'fr-FR', ar: 'ar' }

const STORAGE_KEY = 'iclinic.lang'

// ---------------------------------------------------------------------------
// Strings. Keep keys flat and descriptive; {name}-style placeholders are
// replaced by t()'s second argument.
// ---------------------------------------------------------------------------
const STRINGS = {
  en: {
    'app.name': 'iClinic',
    'app.tagline': 'The right doctor, in minutes.\nDescribe how you feel — we handle the rest.',
    'auth.username': 'Username',
    'auth.usernamePlaceholder': 'doctor or patient',
    'auth.password': 'Password',
    'auth.signIn': 'Sign in',
    'auth.testAccounts': 'Test accounts',
    'auth.enterBoth': 'Enter your username and password.',
    'auth.failed': 'Sign in failed. Try again.',
    'auth.sessionFailed': 'Could not save your session. Try again.',
    'auth.emergencyNote': 'Not for emergencies. If this is urgent, call your local emergency number.',

    'setup.title': 'Nice to meet you',
    'setup.sub': "Two quick details and you're ready to book.",
    'setup.fullName': 'Full name',
    'setup.fullNamePlaceholder': 'Your full name',
    'setup.mobile': 'Mobile number',
    'setup.continue': 'Continue',
    'setup.invalid': 'Please enter your name and mobile number',
    'setup.saveFailed': 'Could not save',

    'home.morning': 'Good morning',
    'home.afternoon': 'Good afternoon',
    'home.evening': 'Good evening',
    'home.assistant': 'Health assistant',
    'home.heroTitle': 'How are you feeling today?',
    'home.heroSub': "Describe your symptoms — we'll match you with the right specialist.",
    'home.startChat': 'Start a chat',
    'home.trustLicensed': 'Licensed doctors',
    'home.trustPrivate': 'Private and secure',
    'home.trustAlways': 'Assistant 24/7',
    'home.nextVisit': 'Next visit',
    'home.specialties': 'Specialties',
    'home.topDoctors': 'Top doctors',
    'home.seeAll': 'See all',

    'doctors.title': 'Find a doctor',
    'doctors.search': 'Search by name or specialty',
    'doctors.all': 'All',
    'doctors.none': 'No doctors found',
    'doctors.noneSub': 'Try a different search or filter.',
    'common.book': 'Book',
    'common.specialist': 'Specialist',

    'chat.title': 'Health assistant',
    'chat.greeting': "Hi, I'm your health assistant 👋 Tell me what's bothering you — your symptoms and how long you've had them — and I'll point you to the right specialty. I don't give medical advice or diagnoses.",
    'chat.common': 'Common concerns',
    'chat.placeholder': 'Describe your symptoms',
    'chat.recommended': 'Top rated for this specialty',
    'chat.emergency': 'If this is an emergency, call your local emergency number or go to the nearest emergency department now.',
    'chat.unreachable': "Sorry, I couldn't reach the assistant.",
    'chat.s1': 'I have a headache',
    'chat.s2': 'Fever and chills',
    'chat.s3': 'Cough and congestion',
    'chat.s4': 'Knee and back pain',
    'chat.s5': 'Trouble sleeping',
    'chat.s6': 'Stomach pain after meals',

    'booking.title': 'Book appointment',
    'booking.chooseDay': 'Choose a day',
    'booking.times': 'Available times',
    'booking.noTimes': 'No open times this day.\nTry another day above.',
    'booking.reason': 'Reason for visit (optional)',
    'booking.reasonPlaceholder': 'Briefly describe the reason',
    'booking.pickTime': 'Pick a time',
    'booking.confirm': 'Confirm booking',
    'booking.booked': "You're booked",
    'booking.viewVisits': 'View my visits',
    'booking.failed': 'Could not book',

    'visits.title': 'My visits',
    'visits.upcoming': 'Upcoming',
    'visits.past': 'Past',
    'visits.noUpcoming': 'No upcoming visits',
    'visits.noUpcomingSub': 'Book a visit with a specialist in a couple of taps.',
    'visits.noPast': 'No past visits',
    'visits.findDoctor': 'Find a doctor',
    'visits.cancel': 'Cancel visit',
    'visits.confirmCancel': 'Cancel this visit?',
    'visits.keep': 'Keep',
    'visits.yesCancel': 'Yes, cancel',
    'visits.cancelFailed': 'Could not cancel',

    'status.scheduled': 'Scheduled',
    'status.in_progress': 'In progress',
    'status.completed': 'Completed',
    'status.cancelled': 'Cancelled',
    'status.no_show': 'No show',

    'profile.title': 'Profile',
    'profile.fullName': 'Full name',
    'profile.mobile': 'Mobile',
    'profile.email': 'Email',
    'profile.edit': 'Edit details',
    'profile.save': 'Save',
    'profile.cancel': 'Cancel',
    'profile.language': 'Language',
    'profile.about': 'About',
    'profile.aboutBody': 'The health assistant offers guidance only — it does not provide medical diagnosis. In an emergency, call your local emergency number.',
    'profile.aboutValue': 'iClinic patient app',
    'profile.signOut': 'Sign out',
    'profile.saveFailed': 'Could not save',
    'profile.invalid': 'Enter a valid name and mobile number',

    'tab.home': 'Home',
    'tab.doctors': 'Doctors',
    'tab.visits': 'Visits',
    'tab.profile': 'Profile',
  },

  fr: {
    'app.name': 'iClinic',
    'app.tagline': 'Le bon médecin, en quelques minutes.\nDécrivez ce que vous ressentez — on s\'occupe du reste.',
    'auth.username': "Nom d'utilisateur",
    'auth.usernamePlaceholder': 'doctor ou patient',
    'auth.password': 'Mot de passe',
    'auth.signIn': 'Se connecter',
    'auth.testAccounts': 'Comptes de test',
    'auth.enterBoth': "Saisissez votre nom d'utilisateur et mot de passe.",
    'auth.failed': 'Échec de la connexion. Réessayez.',
    'auth.sessionFailed': "Impossible d'enregistrer votre session. Réessayez.",
    'auth.emergencyNote': "Pas pour les urgences. Si c'est urgent, appelez votre numéro d'urgence local.",

    'setup.title': 'Enchanté',
    'setup.sub': 'Deux informations et vous pouvez réserver.',
    'setup.fullName': 'Nom complet',
    'setup.fullNamePlaceholder': 'Votre nom complet',
    'setup.mobile': 'Numéro de mobile',
    'setup.continue': 'Continuer',
    'setup.invalid': 'Veuillez saisir votre nom et votre numéro de mobile',
    'setup.saveFailed': "Impossible d'enregistrer",

    'home.morning': 'Bonjour',
    'home.afternoon': 'Bon après-midi',
    'home.evening': 'Bonsoir',
    'home.assistant': 'Assistant santé',
    'home.heroTitle': "Comment vous sentez-vous aujourd'hui ?",
    'home.heroSub': 'Décrivez vos symptômes — nous trouverons le bon spécialiste.',
    'home.startChat': 'Démarrer une discussion',
    'home.trustLicensed': 'Médecins agréés',
    'home.trustPrivate': 'Privé et sécurisé',
    'home.trustAlways': 'Assistant 24/7',
    'home.nextVisit': 'Prochain rendez-vous',
    'home.specialties': 'Spécialités',
    'home.topDoctors': 'Meilleurs médecins',
    'home.seeAll': 'Voir tout',

    'doctors.title': 'Trouver un médecin',
    'doctors.search': 'Rechercher par nom ou spécialité',
    'doctors.all': 'Tous',
    'doctors.none': 'Aucun médecin trouvé',
    'doctors.noneSub': 'Essayez une autre recherche ou un autre filtre.',
    'common.book': 'Réserver',
    'common.specialist': 'Spécialiste',

    'chat.title': 'Assistant santé',
    'chat.greeting': "Bonjour, je suis votre assistant santé 👋 Dites-moi ce qui vous gêne — vos symptômes et depuis quand — et je vous orienterai vers la bonne spécialité. Je ne donne ni conseils médicaux ni diagnostics.",
    'chat.common': 'Motifs fréquents',
    'chat.placeholder': 'Décrivez vos symptômes',
    'chat.recommended': 'Les mieux notés pour cette spécialité',
    'chat.emergency': "En cas d'urgence, appelez votre numéro d'urgence local ou rendez-vous au service des urgences le plus proche immédiatement.",
    'chat.unreachable': "Désolé, je n'ai pas pu joindre l'assistant.",
    'chat.s1': "J'ai mal à la tête",
    'chat.s2': 'Fièvre et frissons',
    'chat.s3': 'Toux et congestion',
    'chat.s4': 'Douleur au genou et au dos',
    'chat.s5': 'Troubles du sommeil',
    'chat.s6': 'Douleur à l\'estomac après les repas',

    'booking.title': 'Prendre rendez-vous',
    'booking.chooseDay': 'Choisir un jour',
    'booking.times': 'Horaires disponibles',
    'booking.noTimes': 'Aucun horaire ce jour-là.\nEssayez un autre jour ci-dessus.',
    'booking.reason': 'Motif de la visite (facultatif)',
    'booking.reasonPlaceholder': 'Décrivez brièvement le motif',
    'booking.pickTime': 'Choisir une heure',
    'booking.confirm': 'Confirmer',
    'booking.booked': 'Rendez-vous confirmé',
    'booking.viewVisits': 'Voir mes rendez-vous',
    'booking.failed': 'Réservation impossible',

    'visits.title': 'Mes rendez-vous',
    'visits.upcoming': 'À venir',
    'visits.past': 'Passés',
    'visits.noUpcoming': 'Aucun rendez-vous à venir',
    'visits.noUpcomingSub': 'Réservez une visite en quelques touches.',
    'visits.noPast': 'Aucun rendez-vous passé',
    'visits.findDoctor': 'Trouver un médecin',
    'visits.cancel': 'Annuler',
    'visits.confirmCancel': 'Annuler ce rendez-vous ?',
    'visits.keep': 'Garder',
    'visits.yesCancel': 'Oui, annuler',
    'visits.cancelFailed': "Impossible d'annuler",

    'status.scheduled': 'Programmé',
    'status.in_progress': 'En cours',
    'status.completed': 'Terminé',
    'status.cancelled': 'Annulé',
    'status.no_show': 'Absent',

    'profile.title': 'Profil',
    'profile.fullName': 'Nom complet',
    'profile.mobile': 'Mobile',
    'profile.email': 'E-mail',
    'profile.edit': 'Modifier',
    'profile.save': 'Enregistrer',
    'profile.cancel': 'Annuler',
    'profile.language': 'Langue',
    'profile.about': 'À propos',
    'profile.aboutBody': "L'assistant santé fournit une orientation uniquement — il ne pose aucun diagnostic. En cas d'urgence, appelez votre numéro d'urgence local.",
    'profile.aboutValue': 'Application patient iClinic',
    'profile.signOut': 'Se déconnecter',
    'profile.saveFailed': "Impossible d'enregistrer",
    'profile.invalid': 'Saisissez un nom et un numéro valides',

    'tab.home': 'Accueil',
    'tab.doctors': 'Médecins',
    'tab.visits': 'Visites',
    'tab.profile': 'Profil',
  },

  ar: {
    'app.name': 'آي كلينك',
    'app.tagline': 'الطبيب المناسب، في دقائق.\nصِف ما تشعر به — ونحن نتكفّل بالباقي.',
    'auth.username': 'اسم المستخدم',
    'auth.usernamePlaceholder': 'doctor أو patient',
    'auth.password': 'كلمة المرور',
    'auth.signIn': 'تسجيل الدخول',
    'auth.testAccounts': 'حسابات تجريبية',
    'auth.enterBoth': 'أدخل اسم المستخدم وكلمة المرور.',
    'auth.failed': 'فشل تسجيل الدخول. حاول مرة أخرى.',
    'auth.sessionFailed': 'تعذّر حفظ الجلسة. حاول مرة أخرى.',
    'auth.emergencyNote': 'ليس للحالات الطارئة. إذا كانت حالتك عاجلة، اتصل برقم الطوارئ المحلي.',

    'setup.title': 'أهلاً بك',
    'setup.sub': 'معلومتان سريعتان ويمكنك الحجز.',
    'setup.fullName': 'الاسم الكامل',
    'setup.fullNamePlaceholder': 'اسمك الكامل',
    'setup.mobile': 'رقم الهاتف',
    'setup.continue': 'متابعة',
    'setup.invalid': 'يرجى إدخال اسمك ورقم هاتفك',
    'setup.saveFailed': 'تعذّر الحفظ',

    'home.morning': 'صباح الخير',
    'home.afternoon': 'مساء الخير',
    'home.evening': 'مساء الخير',
    'home.assistant': 'المساعد الصحي',
    'home.heroTitle': 'كيف تشعر اليوم؟',
    'home.heroSub': 'صِف أعراضك — وسنرشدك إلى الاختصاصي المناسب.',
    'home.startChat': 'ابدأ المحادثة',
    'home.trustLicensed': 'أطباء مرخّصون',
    'home.trustPrivate': 'خصوصية وأمان',
    'home.trustAlways': 'مساعد على مدار الساعة',
    'home.nextVisit': 'الموعد القادم',
    'home.specialties': 'التخصصات',
    'home.topDoctors': 'أفضل الأطباء',
    'home.seeAll': 'عرض الكل',

    'doctors.title': 'ابحث عن طبيب',
    'doctors.search': 'ابحث بالاسم أو التخصص',
    'doctors.all': 'الكل',
    'doctors.none': 'لا يوجد أطباء',
    'doctors.noneSub': 'جرّب بحثاً أو تصفية أخرى.',
    'common.book': 'احجز',
    'common.specialist': 'اختصاصي',

    'chat.title': 'المساعد الصحي',
    'chat.greeting': 'مرحباً، أنا مساعدك الصحي 👋 أخبرني بما يزعجك — الأعراض ومنذ متى — وسأرشدك إلى التخصص المناسب. لا أقدّم نصائح طبية أو تشخيصاً.',
    'chat.common': 'شكاوى شائعة',
    'chat.placeholder': 'صِف أعراضك',
    'chat.recommended': 'الأعلى تقييماً في هذا التخصص',
    'chat.emergency': 'إذا كانت حالتك طارئة، اتصل برقم الطوارئ المحلي أو توجّه إلى أقرب قسم طوارئ الآن.',
    'chat.unreachable': 'عذراً، تعذّر الوصول إلى المساعد.',
    'chat.s1': 'أعاني من صداع',
    'chat.s2': 'حمّى وقشعريرة',
    'chat.s3': 'سعال واحتقان',
    'chat.s4': 'ألم في الركبة والظهر',
    'chat.s5': 'صعوبة في النوم',
    'chat.s6': 'ألم في المعدة بعد الأكل',

    'booking.title': 'حجز موعد',
    'booking.chooseDay': 'اختر اليوم',
    'booking.times': 'الأوقات المتاحة',
    'booking.noTimes': 'لا توجد أوقات متاحة في هذا اليوم.\nجرّب يوماً آخر بالأعلى.',
    'booking.reason': 'سبب الزيارة (اختياري)',
    'booking.reasonPlaceholder': 'اذكر السبب باختصار',
    'booking.pickTime': 'اختر وقتاً',
    'booking.confirm': 'تأكيد الحجز',
    'booking.booked': 'تم الحجز',
    'booking.viewVisits': 'عرض مواعيدي',
    'booking.failed': 'تعذّر الحجز',

    'visits.title': 'مواعيدي',
    'visits.upcoming': 'القادمة',
    'visits.past': 'السابقة',
    'visits.noUpcoming': 'لا توجد مواعيد قادمة',
    'visits.noUpcomingSub': 'احجز زيارة مع اختصاصي بلمستين.',
    'visits.noPast': 'لا توجد مواعيد سابقة',
    'visits.findDoctor': 'ابحث عن طبيب',
    'visits.cancel': 'إلغاء الموعد',
    'visits.confirmCancel': 'إلغاء هذا الموعد؟',
    'visits.keep': 'إبقاء',
    'visits.yesCancel': 'نعم، إلغاء',
    'visits.cancelFailed': 'تعذّر الإلغاء',

    'status.scheduled': 'مجدول',
    'status.in_progress': 'جارٍ',
    'status.completed': 'مكتمل',
    'status.cancelled': 'ملغى',
    'status.no_show': 'لم يحضر',

    'profile.title': 'الملف الشخصي',
    'profile.fullName': 'الاسم الكامل',
    'profile.mobile': 'الهاتف',
    'profile.email': 'البريد الإلكتروني',
    'profile.edit': 'تعديل البيانات',
    'profile.save': 'حفظ',
    'profile.cancel': 'إلغاء',
    'profile.language': 'اللغة',
    'profile.about': 'حول التطبيق',
    'profile.aboutBody': 'يقدّم المساعد الصحي إرشاداً فقط — ولا يقدّم تشخيصاً طبياً. في حالات الطوارئ، اتصل برقم الطوارئ المحلي.',
    'profile.aboutValue': 'تطبيق المرضى iClinic',
    'profile.signOut': 'تسجيل الخروج',
    'profile.saveFailed': 'تعذّر الحفظ',
    'profile.invalid': 'أدخل اسماً ورقم هاتف صحيحين',

    'tab.home': 'الرئيسية',
    'tab.doctors': 'الأطباء',
    'tab.visits': 'المواعيد',
    'tab.profile': 'حسابي',
  },
} as const

export type StringKey = keyof typeof STRINGS.en

type Ctx = {
  lang: Lang
  isRTL: boolean
  locale: string
  ready: boolean
  setLang: (l: Lang) => void
  t: (key: StringKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<Ctx | null>(null)

function applyDirection(lang: Lang) {
  const rtl = lang === 'ar'
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('dir', rtl ? 'rtl' : 'ltr')
      document.documentElement.setAttribute('lang', lang)
    }
  } else {
    // Native needs a reload to fully flip; keep the flag in sync regardless.
    try { I18nManager.allowRTL(rtl) } catch { /* no-op */ }
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        const l = (saved === 'en' || saved === 'fr' || saved === 'ar') ? saved : 'en'
        setLangState(l)
        applyDirection(l)
      })
      .catch(() => applyDirection('en'))
      .finally(() => setReady(true))
  }, [])

  const value = useMemo<Ctx>(() => ({
    lang,
    isRTL: lang === 'ar',
    locale: LOCALES[lang],
    ready,
    setLang: (l: Lang) => {
      setLangState(l)
      applyDirection(l)
      AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {})
    },
    t: (key, vars) => {
      const table = STRINGS[lang] as Record<string, string>
      let out = table[key] ?? (STRINGS.en as Record<string, string>)[key] ?? key
      if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v))
      return out
    },
  }), [lang, ready])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}
