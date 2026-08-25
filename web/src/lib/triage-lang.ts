// Language support for the triage assistant: detection, symptom keywords and
// reply pools for English, French and Arabic.

export type Lang = 'en' | 'fr' | 'ar'

export const LANG_NAME: Record<Lang, string> = { en: 'English', fr: 'French', ar: 'Arabic' }

// Detects the language of a message. Arabic is unambiguous (script); French is
// scored on common words and accents. Falls back to the app's chosen language.
export function detectLang(text: string, fallback: Lang = 'en'): Lang {
  if (/[؀-ۿ]/.test(text)) return 'ar'
  const t = ` ${text.toLowerCase()} `
  const frHits = [
    ' je ', " j'", ' mon ', ' ma ', ' mes ', ' douleur', ' mal ', ' depuis ', ' bonjour', ' merci',
    ' est-ce', ' aide', ' besoin', ' médecin', ' docteur', ' gorge', ' tête', ' ventre', ' dos ',
    ' fièvre', ' toux', ' peau', ' yeux', ' dents', ' salut', ' bonsoir', ' avoir ', ' suis ',
  ].filter((w) => t.includes(w)).length
  if (frHits >= 1) return 'fr'
  return fallback
}

// Specialty keywords per language. Short words (<=4 chars) are matched as whole
// words in the classifier; longer ones match as prefixes.
export const KEYWORDS: Record<Lang, Record<string, string[]>> = {
  en: {
    dermatology: ['skin', 'rash', 'acne', 'pimple', 'mole', 'eczema', 'psoriasis', 'itch', 'hives', 'wart', 'hair loss', 'dandruff', 'nail', 'dry skin', 'sunburn', 'burn'],
    cardiology: ['heart', 'chest', 'palpitation', 'blood pressure', 'hypertension', 'cholesterol', 'irregular heartbeat', 'racing heart'],
    pediatrics: ['my child', 'my baby', 'my kid', 'my son', 'my daughter', 'infant', 'toddler', 'newborn'],
    orthopedics: ['bone', 'joint', 'knee', 'shoulder', 'back pain', 'neck pain', 'fracture', 'sprain', 'sports injury', 'hip', 'ankle', 'wrist', 'arthritis', 'muscle pain', 'elbow', 'broke', 'broken', 'arm', 'leg', 'foot', 'heel', 'spine', 'rib', 'twisted'],
    gynecology: ['pregnan', 'period', 'menstrual', 'menstruation', 'pcos', 'ovar', 'vaginal', 'fertility', 'contracept', 'menopause'],
    otolaryngology: ['ear', 'hearing', 'sinus', 'sore throat', 'tonsil', 'nose bleed', 'nosebleed', 'snoring', 'hoarse', 'blocked nose', 'stuffy nose', 'ringing', 'throat'],
    ophthalmology: ['eye', 'vision', 'blurry', 'blurred', 'seeing spots', 'red eye', 'dry eye', 'glasses'],
    psychiatry: ['anxiety', 'anxious', 'depress', 'panic', 'stress', 'mental health', 'mood', 'insomnia', 'trouble sleeping', 'sleep problem', "can't sleep", 'cant sleep', 'burnout', 'adhd', 'ocd'],
    dentistry: ['tooth', 'teeth', 'gum', 'cavity', 'toothache', 'dental', 'wisdom'],
    neurology: ['headache', 'migraine', 'dizz', 'vertigo', 'numb', 'tingling', 'tremor', 'memory', 'fainting spells', 'nerve pain'],
    gastroenterology: ['stomach', 'abdominal', 'belly', 'nausea', 'vomit', 'diarrhea', 'constipat', 'reflux', 'heartburn', 'bloat', 'ibs', 'bowel', 'indigestion', 'gas'],
    endocrinology: ['diabet', 'thyroid', 'hormone', 'blood sugar', 'weight gain', 'weight loss'],
    urology: ['urin', 'bladder', 'prostate', 'uti', 'pee', 'erectile', 'testic', 'penis', 'dick', 'genital', 'groin', 'scrotum', 'private part', 'down there'],
    nephrology: ['kidney'],
    pulmonology: ['cough', 'asthma', 'wheez', 'lung', 'bronchitis', 'phlegm', 'congestion'],
    rheumatology: ['lupus', 'autoimmune', 'joint stiffness', 'stiff joints', 'inflammation', 'rheumat'],
    allergy_immunology: ['allerg', 'hay fever', 'pollen', 'sneezing', 'food reaction', 'dust'],
    general_practice: ['fever', 'flu', 'cold', 'tired', 'fatigue', 'checkup', 'check-up', 'general', 'unwell', 'sick', 'body ache', 'chills'],
  },
  fr: {
    dermatology: ['peau', 'éruption', 'eruption', 'acné', 'acne', 'bouton', 'grain de beauté', 'eczéma', 'eczema', 'psoriasis', 'démange', 'demange', 'urticaire', 'verrue', 'perte de cheveux', 'pellicule', 'ongle', 'brûlure', 'brulure'],
    cardiology: ['coeur', 'cœur', 'cardiaque', 'palpitation', 'tension', 'hypertension', 'cholestérol', 'cholesterol', 'poitrine', 'thorax'],
    pediatrics: ['mon enfant', 'mon bébé', 'mon bebe', 'ma fille', 'mon fils', 'nourrisson', 'nouveau-né', 'bambin'],
    orthopedics: ['os ', 'articulation', 'genou', 'épaule', 'epaule', 'mal de dos', 'douleur au dos', 'nuque', 'fracture', 'entorse', 'hanche', 'cheville', 'poignet', 'arthrose', 'arthrite', 'muscle', 'coude', 'cassé', 'casse', 'bras', 'jambe', 'pied', 'talon', 'colonne', 'côte', 'foulé'],
    gynecology: ['enceinte', 'grossesse', 'règles', 'regles', 'menstru', 'ovaire', 'vaginal', 'fertilité', 'contracept', 'ménopause', 'menopause'],
    otolaryngology: ['oreille', 'audition', 'sinus', 'gorge', 'amygdale', 'saignement de nez', 'ronflement', 'enroué', 'nez bouché', 'bourdonnement'],
    ophthalmology: ['oeil', 'œil', 'yeux', 'vue', 'vision', 'flou', 'lunettes'],
    psychiatry: ['anxiété', 'anxiete', 'anxieux', 'déprim', 'deprim', 'dépression', 'depression', 'panique', 'stress', 'santé mentale', 'humeur', 'insomnie', 'dormir', 'sommeil', 'burnout'],
    dentistry: ['dent', 'dents', 'gencive', 'carie', 'dentaire', 'sagesse'],
    neurology: ['mal de tête', 'mal a la tete', 'maux de tête', 'céphalée', 'migraine', 'vertige', 'étourdis', 'engourdi', 'fourmill', 'tremblement', 'mémoire', 'nerf'],
    gastroenterology: ['estomac', 'ventre', 'abdomen', 'abdominal', 'nausée', 'nausee', 'vomi', 'diarrhée', 'diarrhee', 'constipation', 'reflux', 'brûlures d\'estomac', 'ballonnement', 'intestin', 'digestion'],
    endocrinology: ['diabèt', 'diabet', 'thyroïde', 'thyroide', 'hormone', 'glycémie', 'prise de poids', 'perte de poids'],
    urology: ['urine', 'uriner', 'vessie', 'prostate', 'infection urinaire', 'érectile', 'erectile', 'testicule', 'pénis', 'penis', 'aine'],
    nephrology: ['rein', 'reins', 'rénal'],
    pulmonology: ['toux', 'tousse', 'asthme', 'sifflement', 'poumon', 'bronchite', 'glaire', 'congestion', 'respir'],
    rheumatology: ['lupus', 'auto-immune', 'raideur', 'inflammation', 'rhumat'],
    allergy_immunology: ['allergi', 'rhume des foins', 'pollen', 'éternue', 'eternue', 'poussière'],
    general_practice: ['fièvre', 'fievre', 'grippe', 'rhume', 'fatigue', 'fatigué', 'bilan', 'checkup', 'général', 'malade', 'courbature', 'frisson'],
  },
  ar: {
    dermatology: ['جلد', 'بشرة', 'طفح', 'حساسية جلد', 'حبوب', 'شامة', 'أكزيما', 'اكزيما', 'صدفية', 'حكة', 'شرى', 'ثؤلول', 'تساقط الشعر', 'قشرة', 'ظفر', 'حرق'],
    cardiology: ['قلب', 'خفقان', 'ضغط الدم', 'الضغط', 'كوليسترول', 'صدر', 'ألم في الصدر'],
    pediatrics: ['طفلي', 'ابني', 'ابنتي', 'رضيع', 'مولود', 'طفل'],
    orthopedics: ['عظم', 'عظام', 'مفصل', 'ركبة', 'كتف', 'ألم الظهر', 'ظهر', 'رقبة', 'كسر', 'التواء', 'ورك', 'كاحل', 'معصم', 'مفاصل', 'عضلة', 'كوع', 'ذراع', 'ساق', 'قدم', 'كعب', 'عمود فقري', 'ضلع'],
    gynecology: ['حامل', 'حمل', 'دورة شهرية', 'الدورة', 'طمث', 'مبيض', 'مهبل', 'خصوبة', 'منع الحمل', 'انقطاع الطمث'],
    otolaryngology: ['أذن', 'اذن', 'سمع', 'جيوب', 'حلق', 'لوز', 'نزيف الأنف', 'شخير', 'بحة', 'انسداد الأنف', 'طنين'],
    ophthalmology: ['عين', 'عيون', 'نظر', 'رؤية', 'ضبابية', 'نظارات'],
    psychiatry: ['قلق', 'اكتئاب', 'كآبة', 'هلع', 'توتر', 'صحة نفسية', 'نفسية', 'مزاج', 'أرق', 'نوم', 'احتراق نفسي'],
    dentistry: ['سن', 'أسنان', 'اسنان', 'ضرس', 'لثة', 'تسوس', 'ألم الأسنان'],
    neurology: ['صداع', 'شقيقة', 'دوخة', 'دوار', 'تنميل', 'وخز', 'رعشة', 'ذاكرة', 'أعصاب', 'عصب'],
    gastroenterology: ['معدة', 'بطن', 'غثيان', 'قيء', 'استفراغ', 'إسهال', 'اسهال', 'إمساك', 'امساك', 'ارتجاع', 'حرقة', 'انتفاخ', 'أمعاء', 'هضم'],
    endocrinology: ['سكري', 'السكر', 'غدة', 'درقية', 'هرمون', 'زيادة الوزن', 'نقص الوزن'],
    urology: ['بول', 'تبول', 'مثانة', 'بروستات', 'التهاب بولي', 'انتصاب', 'خصية', 'قضيب', 'أعضاء تناسلية'],
    nephrology: ['كلى', 'كلية'],
    pulmonology: ['سعال', 'كحة', 'ربو', 'أزيز', 'رئة', 'التهاب شعبي', 'بلغم', 'احتقان', 'تنفس'],
    rheumatology: ['ذئبة', 'مناعة ذاتية', 'تيبس', 'التهاب المفاصل', 'روماتيزم'],
    allergy_immunology: ['حساسية', 'حمى القش', 'لقاح', 'عطس', 'غبار'],
    general_practice: ['حمى', 'حرارة', 'انفلونزا', 'زكام', 'برد', 'تعب', 'إرهاق', 'فحص', 'عام', 'مريض', 'ألم في الجسم', 'قشعريرة'],
  },
}

// Red flags per language — any match routes to emergency care.
export const EMERGENCY: Record<Lang, string[]> = {
  en: [
    'chest pain', 'chest pressure', "can't breathe", 'cant breathe', 'difficulty breathing',
    'short of breath', 'shortness of breath', 'stroke', 'face droop', 'slurred speech',
    'severe bleeding', 'bleeding heavily', 'unconscious', 'passed out', 'fainted',
    'suicid', 'kill myself', 'end my life', 'overdose', 'seizure', 'convulsion',
    'anaphyla', 'severe allergic', 'throat closing', 'poisoned', 'severe head injury',
  ],
  fr: [
    'douleur à la poitrine', 'douleur thoracique', 'oppression thoracique', 'je ne peux pas respirer',
    'difficulté à respirer', 'essoufflement', 'avc', 'paralysie du visage', 'troubles de la parole',
    'saignement abondant', 'hémorragie', 'inconscient', 'évanoui', 'perte de connaissance',
    'suicide', 'me tuer', 'overdose', 'convulsion', 'crise d\'épilepsie', 'anaphyla',
    'allergie grave', 'gorge qui se ferme', 'empoisonné', 'traumatisme crânien',
  ],
  ar: [
    'ألم في الصدر', 'ضغط في الصدر', 'لا أستطيع التنفس', 'صعوبة في التنفس', 'ضيق تنفس',
    'جلطة', 'سكتة', 'تدلي الوجه', 'تلعثم', 'نزيف شديد', 'فقدان الوعي', 'إغماء',
    'انتحار', 'أقتل نفسي', 'جرعة زائدة', 'تشنج', 'نوبة صرع', 'حساسية شديدة',
    'انسداد الحلق', 'تسمم', 'إصابة في الرأس',
  ],
}

// Correction phrases ("no wait, actually...") per language.
export const CORRECTIONS: Record<Lang, string[]> = {
  en: ['no no', 'nooo', 'no wait', 'wait no', 'actually', 'i mean', 'i meant', 'not that', 'forget that', 'forget what i said', 'scratch that', 'instead', 'changed my mind', 'sorry i', 'correction', 'rather'],
  fr: ['non non', 'attendez', 'attends', 'en fait', 'je veux dire', 'je voulais dire', 'pas ça', 'oubliez', 'oublie', 'plutôt', 'changé d\'avis', 'correction', 'désolé'],
  ar: ['لا لا', 'لالا', 'انتظر', 'في الواقع', 'أقصد', 'اقصد', 'ليس هذا', 'انسى', 'بالأحرى', 'غيرت رأيي', 'تصحيح', 'عفواً', 'عذراً'],
}

// Conversational intent patterns per language.
export const PATTERNS: Record<Lang, {
  greeting: RegExp; thanks: RegExp; capabilities: RegExp; advice: RegExp;
  serious: RegExp; ack: RegExp; medicalHint: RegExp
}> = {
  en: {
    greeting: /^(hi|hii+|hello|hey|heyy+|good (morning|afternoon|evening)|salam|marhaba|bonjour|yo)\b[\s!.,]*$/i,
    thanks: /\b(thanks|thank you|thx|shukran|merci|appreciate)\b/i,
    capabilities: /\b(who are you|what can you do|what are you|how do you work|what is this|help me understand)\b/i,
    advice: /\b(advi[cs]e|diagnos|be my doctor|my doctor and|what (medicine|medication|drug|pill)|which (medicine|medication|drug|pill)|should i take|prescribe|home remedy|remedies|how (do|to) (i )?(treat|cure|fix)|treat me|cure me|what should i do|what do you think it is|what('s| is) wrong with me|is it (serious|dangerous)|do i have)\b/i,
    serious: /\b(cancer|tumou?r|lump|leukemia|dying|going to die|terminal)\b/i,
    ack: /^(ok+|okay+|k|alright|fine|got it|sure|cool|yes|yep|yeah|no|nope|hmm+|great|perfect|nice)[\s!.,]*$/i,
    medicalHint: /\b(pain(s|ful)?|hurt(s|ing)?|ach(e|es|ing)|sore|burn(s|ing)?|bleed(s|ing)?|blood|swollen|swelling|symptom(s)?|fever(ish)?|nausea|nauseous|throw(ing)? up|feel(ing)? (bad|sick|off|weird|unwell|awful|terrible|dizzy)|(don'?t|do not|not) feel(ing)? (good|well|right|okay|ok)|not feeling|unwell|sick|ill|itch(y|es|ing)?|cramp(s)?|infect(ed|ion)?|doctor|clinic)\b/i,
  },
  fr: {
    greeting: /^(salut|bonjour|bonsoir|coucou|hey|allo)\b[\s!.,]*$/i,
    thanks: /\b(merci|remercie)\b/i,
    capabilities: /\b(qui es-tu|qui êtes-vous|que peux-tu|que pouvez-vous|comment ça marche|c'est quoi)\b/i,
    advice: /\b(conseil|diagnostic|diagnostiqu|sois mon médecin|quel (médicament|medicament)|quels médicaments|dois-je prendre|prescri|remède|remede|comment (soigner|traiter|guérir)|soigne-moi|que dois-je faire|qu'est-ce que j'ai|c'est grave|est-ce grave)\b/i,
    serious: /\b(cancer|tumeur|grosseur|leucémie|mourir|je vais mourir)\b/i,
    ack: /^(ok+|d'accord|daccord|bien|très bien|compris|oui|non|super|parfait|merci)[\s!.,]*$/i,
    medicalHint: /\b(douleur|mal|souffre|brûl|saigne|sang|gonfl|symptôme|symptome|fièvre|fievre|nausée|nausee|vomi|me sens (mal|pas bien)|pas bien|malade|démange|demange|crampe|infect|médecin|docteur|clinique)\b/i,
  },
  ar: {
    greeting: /^(مرحبا|مرحباً|السلام عليكم|اهلا|أهلاً|هلا|صباح الخير|مساء الخير)[\s!.,]*$/,
    thanks: /(شكرا|شكراً|مشكور|ممنون)/,
    capabilities: /(من أنت|مين انت|ماذا تفعل|شو بتعمل|كيف تعمل|ما هذا)/,
    advice: /(نصيح|تشخيص|شخّص|شخص لي|كن طبيبي|أي دواء|ما الدواء|ماذا آخذ|وصفة|علاج منزلي|كيف أعالج|كيف اعالج|عالجني|ماذا أفعل|ماذا لدي|هل هو خطير|شو عندي)/,
    serious: /(سرطان|ورم|كتلة|لوكيميا|سأموت|بموت)/,
    ack: /^(حسنا|حسناً|طيب|تمام|اوك|أوك|نعم|لا|شكرا|ممتاز|جيد)[\s!.,]*$/,
    medicalHint: /(ألم|الم|وجع|يؤلم|حرق|نزيف|دم|تورم|انتفاخ|عرض|أعراض|حمى|حرارة|غثيان|تقيؤ|أشعر|لا أشعر|مريض|تعبان|حكة|تشنج|التهاب|طبيب|عيادة)/,
  },
}

// Reply pools per language. Same keys as the English original.
// Some pools ignore the specialty name (greetings, thanks…), so the argument
// is optional — call sites can pass it or not.
type Pool = { [k: string]: ((n?: string) => string)[] }

const aan = (n = '') => (/^[aeiou]/i.test(n) ? `an ${n}` : `a ${n}`)

export const POOLS: Record<Lang, Pool> = {
  en: {
    recommend: [
      (n) => `Thanks for telling me. From what you describe, ${n} is the right specialty for this 👍 I've lined up the top-rated doctors below. This is guidance, not a diagnosis.`,
      (n) => `Got it. That sounds like something ${aan(n)} specialist should look at 🩺 Here are the best-rated doctors for it. Remember, I guide you to the right door, I don't diagnose.`,
      (n) => `Understood! The specialty that fits this best is ${n}. Take a look at the top doctors below 👇 (I can't give medical advice. A doctor will assess you properly.)`,
      (n) => `Okay, that points to ${n} 🎯 I've pulled up the highest-rated doctors for you below. This is direction, not a diagnosis.`,
      (n) => `That's one for ${n}. You'll find the top-rated doctors below. Book whichever suits you best 😊 (Guidance only, not medical advice.)`,
      (n) => `Based on what you shared, I'd point you to ${n} 🧭 Below are our best-rated doctors for it. A proper assessment happens at the visit.`,
    ],
    corrected: [
      (n) => `No problem. Updated! ✅ For that, ${n} is the right specialty. Top-rated doctors are below.`,
      (n) => `Got you. Ignoring the earlier one. This points to ${n} instead 🔄 Here are the best doctors for it.`,
      (n) => `Thanks for clarifying 🙌 In that case you'll want ${n}. I've refreshed the doctor list below.`,
      (n) => `Ah, that changes things. ${n} it is 👍 Doctors below are updated for you.`,
    ],
    clarify: [
      () => `I want to point you to the right specialist 🙂 Can you tell me a bit more? Where exactly do you feel it, and since when?`,
      () => `Happy to help! To match you well, tell me the main thing bothering you, for example where it hurts or what feels off.`,
      () => `Let's narrow it down 🔍 What's the main symptom, and how long has it been going on?`,
    ],
    greeting: [
      () => `Hello! 👋 I'm your health assistant. Tell me what's bothering you and I'll point you to the right specialist.`,
      () => `Hi there 😊 Describe your symptoms, even in a few words, and I'll match you with the right specialty.`,
      () => `Hey! I'm here to help you find the right doctor. What's going on with your health today?`,
    ],
    thanks: [
      () => `Anytime! 😊 If anything else comes up, just describe it and I'll point you to the right specialist.`,
      () => `You're welcome! Wishing you a smooth visit 🌟 I'm here whenever you need me.`,
      () => `Glad I could help 🙌 Take care, and don't hesitate to come back.`,
    ],
    capabilities: [
      () => `I'm the clinic's health assistant 🩺 Describe your symptoms and I'll figure out which specialty you need and show you our top-rated doctors, then you can book in a couple of taps. One thing I never do is give medical advice or diagnoses.`,
      () => `My job is simple: you tell me how you feel, I tell you which type of doctor to see, and show you the best-rated ones to book 📅 I don't diagnose or give treatment advice. That's for your doctor.`,
    ],
    noAdvice: [
      () => `I can't give medical advice or suggest treatments. That's a doctor's job 🙏 What I can do is get you to the right one: tell me your symptoms and I'll match the specialty.`,
      () => `That's something only a doctor should answer, so I won't guess 🙅 But describe what you're feeling and I'll point you to the right specialist right away.`,
    ],
    offTopic: [
      () => `Good question, but I'm best at one thing: matching symptoms to the right specialist 😄 Tell me how you're feeling and I'll take it from there.`,
      () => `I'll stay in my lane on that one 🙂 I'm your health navigator. Describe any symptom and I'll find you the right doctor.`,
    ],
    identity: [
      () => `I'm a bot trained to help you pick the right doctor 🤖 Describe a symptom, even a few words, and I'll match you with the right specialty.`,
      () => `That's outside my training. I'm built for one job: helping you pick your doctor 🧭 Tell me how you feel and I'll handle the rest.`,
      () => `I'll pass on that one. I'm just a doctor-matching bot 🙂 But describe any symptom and I'll point you to the right specialist.`,
      () => `My training covers exactly one thing: getting you to the right doctor 🤖 What's bothering you health-wise?`,
    ],
    serious: [
      (n) => `I hear you. A worry like that deserves real attention, not guesses from me. ${aan(n).replace(/^a/, 'A')} can examine you, run the right tests, and refer you to exactly the right specialist if needed. Booking that visit is the right move 💙 Doctors below.`,
      (n) => `That must feel scary, and I won't speculate about something this important. The right step is a proper exam: ${aan(n)} can check you and order tests. You're doing the right thing by looking into it 💙 Top doctors below.`,
    ],
    newComplaint: [
      () => `That sounds like something different. Tell me a bit more about it 🔍 Where exactly is it, and how does it feel?`,
      () => `Okay, new symptom. I'm listening 👂 Where is it and since when?`,
    ],
    sameAgain: [
      (n) => `Still the same answer for that one 🙂 ${n} covers it. The doctors below can help with everything you've mentioned.`,
      (n) => `That also falls under ${n}, so my recommendation stands. Pick any of the doctors below 👇`,
    ],
    ack: [
      () => `Ready when you are. Tap Book on any doctor below, or tell me if anything else is bothering you 🙂`,
      () => `Take your time! I'm here if you want to describe anything else.`,
    ],
    notOffered: [
      (n) => `Honest note: we don't currently have that exact specialist at this clinic 😕 ${aan(n).replace(/^a/, 'A')} can assess you and refer you onward. Top-rated ones are below.`,
      (n) => `We don't have that specialty in-house right now. Best next step: see ${aan(n)} here. They can evaluate and refer you. Doctors below 👇`,
    ],
  },

  fr: {
    recommend: [
      (n) => `Merci pour ces précisions. D'après ce que vous décrivez, la spécialité adaptée est ${n} 👍 Les médecins les mieux notés sont ci-dessous. Ceci est une orientation, pas un diagnostic.`,
      (n) => `Compris. Cela relève plutôt d'un spécialiste en ${n} 🩺 Voici les mieux notés. Je vous oriente, je ne diagnostique pas.`,
      (n) => `Très bien ! La spécialité la plus adaptée est ${n}. Découvrez les meilleurs médecins ci-dessous 👇 (Je ne donne pas de conseils médicaux. Un médecin vous examinera.)`,
      (n) => `D'accord, cela oriente vers ${n} 🎯 J'ai sélectionné les médecins les mieux notés ci-dessous. C'est une orientation, pas un diagnostic.`,
      (n) => `C'est pour ${n}. Vous trouverez ci-dessous les médecins les mieux notés. Réservez celui qui vous convient 😊 (Orientation uniquement.)`,
      (n) => `D'après ce que vous partagez, je vous oriente vers ${n} 🧭 Voici nos médecins les mieux notés. L'évaluation se fera lors de la consultation.`,
    ],
    corrected: [
      (n) => `Pas de souci. C'est mis à jour ! ✅ Dans ce cas, la spécialité est ${n}. Les médecins les mieux notés sont ci-dessous.`,
      (n) => `Compris. J'oublie le précédent. Cela oriente plutôt vers ${n} 🔄 Voici les meilleurs médecins.`,
      (n) => `Merci pour la précision 🙌 Dans ce cas, il vous faut ${n}. J'ai actualisé la liste ci-dessous.`,
      (n) => `Ah, cela change les choses. Ce sera ${n} 👍 La liste est mise à jour.`,
    ],
    clarify: [
      () => `Je veux vous orienter vers le bon spécialiste 🙂 Pouvez-vous préciser : où exactement le ressentez-vous, et depuis quand ?`,
      () => `Avec plaisir ! Pour bien vous orienter, dites-moi ce qui vous gêne le plus, par exemple où vous avez mal.`,
      () => `Précisons un peu 🔍 Quel est le symptôme principal, et depuis combien de temps ?`,
    ],
    greeting: [
      () => `Bonjour ! 👋 Je suis votre assistant santé. Dites-moi ce qui vous gêne et je vous orienterai vers le bon spécialiste.`,
      () => `Salut 😊 Décrivez vos symptômes, même en quelques mots, et je trouverai la bonne spécialité.`,
      () => `Bonjour ! Je suis là pour vous aider à trouver le bon médecin. Comment vous sentez-vous ?`,
    ],
    thanks: [
      () => `Avec plaisir ! 😊 Si autre chose survient, décrivez-le et je vous orienterai.`,
      () => `Je vous en prie ! Bonne consultation 🌟 Je reste disponible.`,
      () => `Ravi d'avoir pu aider 🙌 Prenez soin de vous. Revenez quand vous voulez.`,
    ],
    capabilities: [
      () => `Je suis l'assistant santé de la clinique 🩺 Décrivez vos symptômes : je détermine la spécialité qu'il vous faut et vous montre nos médecins les mieux notés. Vous réservez en deux touches. Je ne donne jamais de conseils médicaux ni de diagnostic.`,
      () => `Mon rôle est simple : vous me dites ce que vous ressentez, je vous dis quel type de médecin consulter et vous montre les mieux notés 📅 Je ne diagnostique pas. C'est le rôle du médecin.`,
    ],
    noAdvice: [
      () => `Je ne peux pas donner de conseils médicaux ni proposer de traitement. C'est le rôle du médecin 🙏 En revanche, je peux vous orienter : décrivez vos symptômes et je trouve la spécialité.`,
      () => `Seul un médecin peut répondre à cela, je ne vais pas deviner 🙅 Mais décrivez ce que vous ressentez et je vous oriente tout de suite.`,
    ],
    offTopic: [
      () => `Bonne question, mais je ne sais bien faire qu'une chose : orienter vos symptômes vers le bon spécialiste 😄 Comment vous sentez-vous ?`,
      () => `Je reste dans mon domaine 🙂 Je suis votre guide santé. Décrivez un symptôme et je trouve le bon médecin.`,
    ],
    identity: [
      () => `Je suis un assistant conçu pour vous aider à choisir le bon médecin 🤖 Décrivez un symptôme, même en quelques mots, et je trouve la spécialité adaptée.`,
      () => `Cela dépasse mon domaine. Je suis fait pour une seule chose : vous aider à choisir votre médecin 🧭 Dites-moi comment vous vous sentez.`,
      () => `Je passe mon tour sur ce sujet. Je ne suis qu'un assistant qui oriente vers les médecins 🙂 Décrivez un symptôme et je vous oriente.`,
      () => `Mon domaine se limite à une chose : vous orienter vers le bon médecin 🤖 Qu'est-ce qui vous gêne côté santé ?`,
    ],
    serious: [
      (n) => `Je comprends votre inquiétude. Cela mérite un vrai avis médical, pas des suppositions de ma part. Un spécialiste en ${n} peut vous examiner, prescrire les examens nécessaires et vous orienter si besoin. Prendre rendez-vous est la bonne démarche 💙 Médecins ci-dessous.`,
      (n) => `Cela doit être angoissant, et je ne vais pas spéculer sur un sujet aussi important. La bonne étape est un examen : un spécialiste en ${n} peut vous examiner et prescrire des analyses. Vous faites bien de vous en occuper 💙`,
    ],
    newComplaint: [
      () => `Cela semble différent. Dites-m'en un peu plus 🔍 Où exactement, et comment cela se manifeste ?`,
      () => `D'accord, nouveau symptôme. Je vous écoute 👂 Où est-ce, et depuis quand ?`,
    ],
    sameAgain: [
      (n) => `Même réponse pour cela 🙂 ${n} couvre aussi ce point. Les médecins ci-dessous peuvent vous aider.`,
      (n) => `Cela relève également de ${n}, ma recommandation reste la même. Choisissez un médecin ci-dessous 👇`,
    ],
    ack: [
      () => `Quand vous voulez. Appuyez sur Réserver, ou dites-moi si autre chose vous gêne 🙂`,
      () => `Prenez votre temps ! Je suis là si vous voulez décrire autre chose.`,
    ],
    notOffered: [
      (n) => `En toute transparence : nous n'avons pas ce spécialiste dans cette clinique 😕 Un médecin en ${n} peut vous examiner et vous orienter. Les mieux notés sont ci-dessous.`,
      (n) => `Cette spécialité n'est pas disponible ici actuellement. La meilleure étape : consulter en ${n}. Ils pourront vous orienter. Médecins ci-dessous 👇`,
    ],
  },

  ar: {
    recommend: [
      (n) => `شكراً لإخباري. بناءً على ما تصفه، التخصص المناسب هو ${n} 👍 وضعت لك الأطباء الأعلى تقييماً بالأسفل، هذا إرشاد وليس تشخيصاً.`,
      (n) => `فهمت. يبدو أن هذا من اختصاص ${n} 🩺 إليك الأطباء الأعلى تقييماً، أنا أرشدك للباب الصحيح ولا أشخّص.`,
      (n) => `تمام! التخصص الأنسب لحالتك هو ${n}. اطّلع على الأطباء بالأسفل 👇 (لا أقدّم نصائح طبية، الطبيب سيقيّم حالتك.)`,
      (n) => `حسناً، هذا يشير إلى ${n} 🎯 اخترت لك الأطباء الأعلى تقييماً بالأسفل. هذا توجيه وليس تشخيصاً.`,
      (n) => `هذه الحالة من اختصاص ${n}. ستجد الأطباء الأعلى تقييماً بالأسفل، احجز مع من يناسبك 😊 (إرشاد فقط.)`,
      (n) => `بناءً على ما ذكرت، أرشدك إلى ${n} 🧭 بالأسفل أفضل أطبائنا تقييماً. التقييم الدقيق يتم في الزيارة.`,
    ],
    corrected: [
      (n) => `لا مشكلة، تم التحديث! ✅ في هذه الحالة التخصص المناسب هو ${n}. الأطباء بالأسفل.`,
      (n) => `فهمتك، سأتجاهل ما سبق. هذا يشير إلى ${n} بدلاً من ذلك 🔄 إليك أفضل الأطباء.`,
      (n) => `شكراً للتوضيح 🙌 إذاً أنت بحاجة إلى ${n}. حدّثت قائمة الأطباء بالأسفل.`,
      (n) => `آه، هذا يغيّر الأمر، ${n} إذاً 👍 القائمة محدّثة لك.`,
    ],
    clarify: [
      () => `أريد إرشادك إلى الاختصاصي المناسب 🙂 هل يمكنك التوضيح أكثر، أين تشعر به بالضبط، ومنذ متى؟`,
      () => `بكل سرور! لأرشدك جيداً، أخبرني بأكثر ما يزعجك، مثلاً أين يؤلمك.`,
      () => `لنحدد الأمر 🔍 ما العَرَض الأساسي، ومنذ متى بدأ؟`,
    ],
    greeting: [
      () => `مرحباً! 👋 أنا مساعدك الصحي. أخبرني بما يزعجك وسأرشدك إلى الاختصاصي المناسب.`,
      () => `أهلاً 😊 صِف أعراضك، ولو بكلمات قليلة، وسأجد لك التخصص المناسب.`,
      () => `مرحباً! أنا هنا لمساعدتك في العثور على الطبيب المناسب. كيف تشعر اليوم؟`,
    ],
    thanks: [
      () => `على الرحب والسعة! 😊 إذا استجد أي شيء، صِفه لي وسأرشدك.`,
      () => `العفو! أتمنى لك زيارة موفقة 🌟 أنا هنا وقتما تحتاجني.`,
      () => `سعيد بمساعدتك 🙌 اعتنِ بنفسك، ولا تتردد في العودة.`,
    ],
    capabilities: [
      () => `أنا المساعد الصحي في العيادة 🩺 صِف أعراضك وسأحدد التخصص الذي تحتاجه وأعرض عليك أطباءنا الأعلى تقييماً، ثم تحجز بلمستين. الشيء الوحيد الذي لا أفعله أبداً هو تقديم نصائح طبية أو تشخيص.`,
      () => `مهمتي بسيطة: تخبرني كيف تشعر، وأخبرك بنوع الطبيب المناسب وأعرض الأعلى تقييماً للحجز 📅 لا أشخّص ولا أصف علاجاً، هذا دور طبيبك.`,
    ],
    noAdvice: [
      () => `لا أستطيع تقديم نصائح طبية أو اقتراح علاج، هذا من عمل الطبيب 🙏 لكن يمكنني إرشادك: صِف أعراضك وسأحدد التخصص.`,
      () => `هذا سؤال يجيب عنه الطبيب فقط، ولن أخمّن 🙅 لكن صِف ما تشعر به وسأرشدك فوراً إلى الاختصاصي المناسب.`,
    ],
    offTopic: [
      () => `سؤال جيد، لكنني أُجيد أمراً واحداً: مطابقة الأعراض بالاختصاصي المناسب 😄 أخبرني كيف تشعر.`,
      () => `سأبقى في مجالي 🙂 أنا مرشدك الصحي، صِف أي عَرَض وسأجد لك الطبيب المناسب.`,
    ],
    identity: [
      () => `أنا روبوت مدرَّب لمساعدتك في اختيار الطبيب المناسب 🤖 صِف عَرَضاً، ولو بكلمات قليلة، وسأحدد لك التخصص.`,
      () => `هذا خارج تدريبي، مهمتي واحدة: مساعدتك في اختيار طبيبك 🧭 أخبرني كيف تشعر وسأتكفّل بالباقي.`,
      () => `سأعتذر عن هذا، أنا مجرد روبوت لمطابقة الأطباء 🙂 لكن صِف أي عَرَض وسأرشدك.`,
      () => `تدريبي يغطي شيئاً واحداً: إيصالك إلى الطبيب المناسب 🤖 ما الذي يزعجك صحياً؟`,
    ],
    serious: [
      (n) => `أتفهّم قلقك، أمر كهذا يستحق اهتماماً حقيقياً وليس تخميناً مني. طبيب ${n} يمكنه فحصك وإجراء الفحوصات المناسبة وتحويلك عند الحاجة. حجز الموعد هو الخطوة الصحيحة 💙 الأطباء بالأسفل.`,
      (n) => `أتفهّم أن الأمر مقلق، ولن أتكهّن في مسألة بهذه الأهمية. الخطوة الصحيحة فحص طبي: طبيب ${n} يمكنه فحصك وطلب التحاليل. أنت تتصرف بشكل صحيح 💙`,
    ],
    newComplaint: [
      () => `يبدو أن هذا شيء مختلف، أخبرني المزيد 🔍 أين هو بالضبط، وكيف تشعر به؟`,
      () => `حسناً، عَرَض جديد، أنا أستمع 👂 أين هو ومنذ متى؟`,
    ],
    sameAgain: [
      (n) => `الإجابة نفسها لهذه الحالة 🙂 ${n} يغطيها، الأطباء بالأسفل يمكنهم مساعدتك في كل ما ذكرت.`,
      (n) => `هذا أيضاً ضمن ${n}، لذا توصيتي كما هي. اختر أي طبيب بالأسفل 👇`,
    ],
    ack: [
      () => `جاهز وقتما تريد، اضغط "احجز" لدى أي طبيب بالأسفل، أو أخبرني إن كان هناك شيء آخر 🙂`,
      () => `خذ وقتك! أنا هنا إن أردت وصف أي شيء آخر.`,
    ],
    notOffered: [
      (n) => `للأمانة: لا يتوفر هذا الاختصاصي في العيادة حالياً 😕 طبيب ${n} يمكنه تقييم حالتك وتحويلك، الأعلى تقييماً بالأسفل.`,
      (n) => `هذا التخصص غير متوفر لدينا حالياً. الخطوة الأفضل: زيارة طبيب ${n} هنا، يمكنه التقييم والتحويل. الأطباء بالأسفل 👇`,
    ],
  },
}

// Emergency wording per language.
export const EMERGENCY_TEXT: Record<Lang, (specialty: string) => string> = {
  en: (n) => `🚨 Some of what you described can be serious. Please call your local emergency number or go to the nearest emergency department now. For follow-up care afterwards, ${n} is the right specialty, but emergency care comes first.`,
  fr: (n) => `🚨 Certains éléments que vous décrivez peuvent être graves. Appelez votre numéro d'urgence local ou rendez-vous aux urgences les plus proches immédiatement. Pour le suivi ensuite, la spécialité adaptée est ${n}, mais les urgences d'abord.`,
  ar: (n) => `🚨 بعض ما وصفته قد يكون خطيراً. يرجى الاتصال برقم الطوارئ المحلي أو التوجه إلى أقرب قسم طوارئ الآن. للمتابعة لاحقاً، التخصص المناسب هو ${n}، لكن الطوارئ أولاً.`,
}

// Specialty display names per language (the DB stores English).
export const SPECIALTY_NAMES: Record<Lang, Record<string, string>> = {
  en: {},
  fr: {
    general_practice: 'Médecine générale',
    family_medicine: 'Médecine familiale',
    internal_medicine: 'Médecine interne',
    dermatology: 'Dermatologie',
    cardiology: 'Cardiologie',
    pediatrics: 'Pédiatrie',
    orthopedics: 'Orthopédie',
    gynecology: 'Gynécologie et obstétrique',
    otolaryngology: 'ORL (oreille, nez, gorge)',
    ophthalmology: 'Ophtalmologie',
    psychiatry: 'Psychiatrie',
    dentistry: 'Dentisterie',
    neurology: 'Neurologie',
    gastroenterology: 'Gastro-entérologie',
    endocrinology: 'Endocrinologie',
    urology: 'Urologie',
    pulmonology: 'Pneumologie',
    rheumatology: 'Rhumatologie',
    nephrology: 'Néphrologie',
    allergy_immunology: 'Allergologie et immunologie',
  },
  ar: {
    general_practice: 'الطب العام',
    family_medicine: 'طب الأسرة',
    internal_medicine: 'الطب الباطني',
    dermatology: 'الأمراض الجلدية',
    cardiology: 'أمراض القلب',
    pediatrics: 'طب الأطفال',
    orthopedics: 'جراحة العظام',
    gynecology: 'النساء والتوليد',
    otolaryngology: 'الأنف والأذن والحنجرة',
    ophthalmology: 'طب العيون',
    psychiatry: 'الطب النفسي',
    dentistry: 'طب الأسنان',
    neurology: 'طب الأعصاب',
    gastroenterology: 'الجهاز الهضمي',
    endocrinology: 'الغدد الصماء',
    urology: 'المسالك البولية',
    pulmonology: 'أمراض الصدر',
    rheumatology: 'أمراض الروماتيزم',
    nephrology: 'أمراض الكلى',
    allergy_immunology: 'الحساسية والمناعة',
  },
}

export function specialtyName(slug: string | null, fallback: string, lang: Lang): string {
  if (!slug) return fallback
  return SPECIALTY_NAMES[lang][slug] ?? fallback
}

// Everyday phrases that contain a medical word but aren't medical. Arabic is
// matched as substrings (no word boundaries), so these must be removed first:
// "كرة القدم" (football) contains "قدم" (foot).
const NON_MEDICAL_PHRASES = [
  'كرة القدم', 'كرة السلة', 'كرة اليد', 'رأس المال', 'على قدم وساق',
  'football', 'basketball', 'handball',
  'coupe du monde', 'ballon',
]

export function stripNonMedical(text: string): string {
  let out = text
  for (const phrase of NON_MEDICAL_PHRASES) out = out.split(phrase).join(' ')
  return out
}

export const DISCLAIMER: Record<Lang, string> = {
  en: 'This is guidance to the right specialist, not a diagnosis or medical advice.',
  fr: "Ceci est une orientation vers le bon spécialiste, pas un diagnostic ni un conseil médical.",
  ar: 'هذا إرشاد إلى الاختصاصي المناسب، وليس تشخيصاً أو نصيحة طبية.',
}
