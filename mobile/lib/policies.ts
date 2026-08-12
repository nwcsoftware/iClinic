// ---------------------------------------------------------------------------
// Terms, privacy and refund policies, held in the app itself.
//
// These normally live on the web project, but that is a separate deployment and
// a separate domain. Keeping them here means everything a payment provider
// checks — what the product is, what it costs, and the three policies — is
// reachable on the app's own domain with nothing else running.
//
// Deliberately English only: a mistranslated legal term is worse than an
// untranslated one, and these are read by reviewers rather than patients.
// ---------------------------------------------------------------------------

export const CONTACT = {
  legalName: 'Jad Chami',
  email: 'jadchamy2001@gmail.com',
  phone: '+961 81 609 293',
  location: 'Lebanon',
  priceUsd: 9.99,
  lastUpdated: '12 August 2026',
}

export type Policy = {
  key: 'terms' | 'privacy' | 'refunds'
  title: string
  sections: { heading?: string; body: string[] }[]
}

const P = CONTACT

export const POLICIES: Record<Policy['key'], Policy> = {
  terms: {
    key: 'terms',
    title: 'Terms of Service',
    sections: [
      {
        body: [
          `These terms govern your use of iClinic, an appointment booking and clinic management service operated by ${P.legalName}, based in ${P.location}. By creating an account or using the service you agree to them.`,
        ],
      },
      {
        heading: 'What iClinic is',
        body: [
          'iClinic helps patients find and book appointments with doctors, and helps doctors manage their schedule, patients and prescriptions. It includes an assistant that reads a description of your symptoms and suggests which medical speciality is likely to be relevant.',
        ],
      },
      {
        heading: 'iClinic is not a medical service',
        body: [
          'The assistant does not diagnose, treat, or give medical advice. It only suggests which kind of doctor to see. Nothing in the app is a substitute for consultation with a qualified professional. Never delay seeking medical help because of something the app said.',
          'In an emergency, call your local emergency number immediately. In Lebanon that is 112 for police, 140 for the Red Cross ambulance, and 125 for Civil Defence. Do not use iClinic to report an emergency.',
          'Doctors listed on iClinic are independent practitioners, responsible for the care they provide including any diagnosis, treatment or prescription. iClinic is a booking and record-keeping tool and is not a party to the doctor-patient relationship.',
        ],
      },
      {
        heading: 'Accounts',
        body: [
          'You must give accurate information and keep your login details secure. You are responsible for activity on your account. Accounts are personal and must not be shared. We may suspend an account used to abuse the service, impersonate someone, or break these terms.',
        ],
      },
      {
        heading: 'Doctor subscriptions',
        body: [
          `Doctors pay $${P.priceUsd.toFixed(2)} per month to appear in the patient app and accept bookings. New doctor accounts start with a free trial. When a subscription is not active the doctor stops appearing to patients and cannot take new bookings; their existing records remain intact.`,
          'Prices are in US dollars and shown before payment. We may change the price, and will give notice before a change affects an existing subscriber. Patients pay nothing to use iClinic; any fee for medical care is agreed directly with the doctor.',
        ],
      },
      {
        heading: 'Acceptable use',
        body: [
          'Do not use the service to harass anyone or to submit false information. Do not attempt to access records that are not yours, or to disrupt the service. Do not book appointments you do not intend to attend, or list yourself as a doctor without the qualifications to practise.',
        ],
      },
      {
        heading: 'Availability and liability',
        body: [
          'We work to keep iClinic available, but it is provided as-is and we do not guarantee uninterrupted service. To the extent permitted by law, we are not liable for indirect or consequential loss arising from your use of iClinic, nor for the medical care provided by a doctor found through the service. Nothing here limits liability that cannot legally be limited.',
        ],
      },
      {
        heading: 'Governing law and contact',
        body: [
          `These terms are governed by the laws of ${P.location}. For any question, contact ${P.email} or ${P.phone}.`,
        ],
      },
    ],
  },

  privacy: {
    key: 'privacy',
    title: 'Privacy Policy',
    sections: [
      {
        body: [
          `iClinic is operated by ${P.legalName} in ${P.location}. This policy explains what we collect, why, and what control you have. iClinic handles health information, so we have tried to be specific rather than vague.`,
        ],
      },
      {
        heading: 'What we collect',
        body: [
          'Account details: name, mobile number, email, and for patients optionally date of birth and gender.',
          'Health information you choose to add: allergies, long-term illnesses, blood type and notes in your medical profile.',
          'Appointments: which doctor, when, and the reason for the visit if you give one.',
          'Prescriptions: medicines a doctor prescribes you, with dosage and instructions.',
          'Assistant conversations: what you type to the symptom assistant and what it replies.',
          'Reviews: a rating and optional comment after a visit.',
          'Billing records for doctors: subscription status and payment history. We never see or store full card numbers — only the card brand, last four digits and expiry.',
        ],
      },
      {
        heading: 'Why we hold it',
        body: [
          'To run the service: to book appointments, to show a doctor the information they need before treating you, to let you read your own prescriptions, and to manage doctor subscriptions. We do not sell your data, and we do not use your health information for advertising.',
        ],
      },
      {
        heading: 'Who can see it',
        body: [
          'You: your own profile, appointments, prescriptions and conversations.',
          'Doctors you have booked with: your contact details, the medical profile you filled in, your visit history with them, and prescriptions. A doctor you have never had an appointment with cannot open your record.',
          'Clinic staff, where a clinic uses iClinic to manage its bookings.',
          'Service providers we rely on for hosting, database and payments, who process data on our instructions.',
          'The symptom assistant may send the text you type to an AI provider to generate a reply. Do not enter information you would not want processed that way.',
        ],
      },
      {
        heading: 'Storage and retention',
        body: [
          'Data is stored on managed cloud infrastructure, which may be located outside Lebanon. Access is restricted, connections are encrypted in transit, and database rules prevent accounts from reading records that are not theirs.',
          'We keep your account and medical records while your account is open. If you ask us to delete your account we remove your personal data, except where we must keep a record for legal or accounting reasons.',
        ],
      },
      {
        heading: 'Your choices',
        body: [
          'Edit your profile, allergies and long-term illnesses at any time in the app. Ask for a copy of your data, or ask us to correct or delete it. The medical profile is optional, though a doctor then knows less about you.',
          `To make any of these requests, email ${P.email}. We will respond within 30 days.`,
        ],
      },
      {
        heading: 'Children and contact',
        body: [
          'iClinic is intended for adults. A parent or guardian may book on behalf of a child and is responsible for the information they provide.',
          `For any privacy question, contact ${P.email} or ${P.phone}.`,
        ],
      },
    ],
  },

  refunds: {
    key: 'refunds',
    title: 'Refunds & Cancellation',
    sections: [
      {
        body: [
          `This policy covers the $${P.priceUsd.toFixed(2)} per month doctor subscription. Patients are not charged to use iClinic, so nothing here applies to them — any fee for medical care is a matter between the patient and the doctor.`,
        ],
      },
      {
        heading: 'Free trial',
        body: [
          'New doctor accounts include a free trial. You are not charged during the trial, and if you do nothing at the end of it your account simply stops appearing to patients. You do not need to cancel a trial to avoid being billed.',
        ],
      },
      {
        heading: 'Cancelling',
        body: [
          `You can cancel at any time from Billing & payments in the app, or by emailing ${P.email}. Cancelling stops the subscription renewing; it does not cut short the period you have already paid for.`,
          'You keep full access until the end of your paid period. After that your profile stops appearing to patients and you cannot take new bookings. Your account, patient records and prescription history are kept, and reactivating restores access to them.',
        ],
      },
      {
        heading: 'When we refund',
        body: [
          'Within 14 days of a first payment: if iClinic is not right for you, tell us within 14 days of your first charge and we will refund it in full.',
          'Duplicate or incorrect charges: if you were charged twice, or charged after cancelling, we refund the difference in full.',
          'Extended service failure: if iClinic is unavailable for a prolonged period through our fault, we refund or credit the affected time.',
          'Outside those cases we do not refund part of a month that has already started, since the subscription remains fully usable until the period ends.',
        ],
      },
      {
        heading: 'How to request a refund',
        body: [
          `Email ${P.email} with the email address on your account and, if you have it, the payment reference. We aim to reply within 2 working days. Approved refunds are returned by the same method you paid with, and typically take 5-10 working days to appear.`,
        ],
      },
      {
        heading: 'Payments made by transfer',
        body: [
          'Where you pay by Whish, OMT or bank transfer, your account is activated once we confirm the payment. If you reported a payment we cannot find, we will contact you before doing anything, and you will not be charged again.',
        ],
      },
    ],
  },
}
