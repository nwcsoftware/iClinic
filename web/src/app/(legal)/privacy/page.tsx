import type { Metadata } from 'next'
import { org } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Privacy Policy — iClinic',
  description: 'What data iClinic collects, why, who can see it, and how to have it deleted.',
}

export default function PrivacyPage() {
  const provider = org.legalName || '[legal name not set]'

  return (
    <>
      <h1>Privacy Policy</h1>
      <p>
        {org.product} is operated by <strong>{provider}</strong> in {org.location}. This policy
        explains what we collect, why, and what control you have. {org.product} handles health
        information, so we have tried to be specific rather than vague.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details</strong> — name, mobile number, email, and for patients optionally
          date of birth and gender.
        </li>
        <li>
          <strong>Health information you choose to add</strong> — allergies, long-term illnesses,
          blood type and any notes you write in your medical profile.
        </li>
        <li>
          <strong>Appointments</strong> — which doctor, when, and the reason for the visit if you
          give one.
        </li>
        <li>
          <strong>Prescriptions</strong> — medicines a doctor prescribes you, with dosage and
          instructions.
        </li>
        <li>
          <strong>Assistant conversations</strong> — what you type to the symptom assistant and what
          it replies, so you can return to a conversation.
        </li>
        <li>
          <strong>Reviews</strong> — a rating and optional comment after a visit.
        </li>
        <li>
          <strong>Billing records for doctors</strong> — subscription status and payment history. We
          never see or store full card numbers; where card payment is used, only the card brand,
          last four digits and expiry are kept.
        </li>
      </ul>

      <h2>Why we hold it</h2>
      <p>
        To run the service: to book appointments, to show a doctor the information they need before
        treating you, to let you read your own prescriptions, and to manage doctor subscriptions.
        We do not sell your data, and we do not use your health information for advertising.
      </p>

      <h2>Who can see your information</h2>
      <ul>
        <li>
          <strong>You</strong> — your own profile, appointments, prescriptions and conversations.
        </li>
        <li>
          <strong>Doctors you have booked with</strong> — your contact details, the medical profile
          you have filled in, your visit history with them, and prescriptions. A doctor you have
          never had an appointment with cannot open your record.
        </li>
        <li>
          <strong>Clinic staff</strong> where a clinic uses {org.product} to manage its bookings.
        </li>
        <li>
          <strong>Service providers we rely on</strong> — our hosting and database provider, and a
          payment provider for doctor subscriptions. They process data on our instructions.
        </li>
      </ul>
      <p>
        The symptom assistant may send the text you type to an AI provider to generate a reply. Do
        not enter information you would not want processed that way.
      </p>

      <h2>Where it is stored</h2>
      <p>
        Data is stored on managed cloud infrastructure, which may be located outside Lebanon.
        Access is restricted, connections are encrypted in transit, and database rules prevent
        accounts from reading records that are not theirs.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account and medical records while your account is open, because a medical
        history is only useful over time. If you ask us to delete your account we remove your
        personal data, except where we must keep a record for legal or accounting reasons — for
        example a payment record.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Edit your profile, allergies and long-term illnesses at any time in the app.</li>
        <li>Ask for a copy of your data, or ask us to correct or delete it.</li>
        <li>Leave the medical profile empty — it is optional, though a doctor then knows less about you.</li>
      </ul>
      <p>
        To make any of these requests, email <a href={`mailto:${org.email}`}>{org.email}</a>. We will
        respond within 30 days.
      </p>

      <h2>Children</h2>
      <p>
        {org.product} is intended for adults. A parent or guardian may book on behalf of a child and
        is responsible for the information they provide.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We will update this policy if what we do changes, and will note the date at the bottom of
        the page. For any privacy question, contact{' '}
        <a href={`mailto:${org.email}`}>{org.email}</a>
        {org.phone ? <> or {org.phone}</> : null}.
      </p>
    </>
  )
}
