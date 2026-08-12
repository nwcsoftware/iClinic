import type { Metadata } from 'next'
import { org } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Terms of Service — iClinic',
  description: 'The terms under which iClinic is provided to doctors and patients in Lebanon.',
}

export default function TermsPage() {
  const provider = org.legalName || '[legal name not set]'

  return (
    <>
      <h1>Terms of Service</h1>
      <p>
        These terms govern your use of {org.product}, an appointment booking and clinic management
        service operated by <strong>{provider}</strong>, based in {org.location}. By creating an
        account or using the service you agree to them.
      </p>

      <h2>1. What iClinic is</h2>
      <p>
        {org.product} helps patients find and book appointments with doctors, and helps doctors
        manage their schedule, patients and prescriptions. It includes an assistant that reads a
        description of your symptoms and suggests which medical speciality is likely to be relevant.
      </p>

      <h2>2. iClinic is not a medical service</h2>
      <p>
        <strong>
          The assistant does not diagnose, treat, or give medical advice. It only suggests which
          kind of doctor to see.
        </strong>{' '}
        Nothing in the app is a substitute for consultation with a qualified professional. Never
        delay seeking medical help because of something the app said.
      </p>
      <p>
        <strong>In an emergency, call your local emergency number immediately.</strong> In Lebanon
        that is 112 for police, 140 for the Red Cross ambulance, and 125 for Civil Defence. Do not
        use {org.product} to report an emergency.
      </p>
      <p>
        Doctors listed on {org.product} are independent practitioners. They are responsible for the
        care they provide, including any diagnosis, treatment or prescription. {org.product} is a
        booking and record-keeping tool and is not a party to the doctor–patient relationship.
      </p>

      <h2>3. Accounts</h2>
      <p>
        You must give accurate information and keep your login details secure. You are responsible
        for activity on your account. Accounts are personal and must not be shared. We may suspend
        an account that is used to abuse the service, impersonate someone, or break these terms.
      </p>

      <h2>4. Doctor subscriptions</h2>
      <p>
        Doctors pay <strong>${org.priceUsd.toFixed(2)} per month</strong> to appear in the patient
        app and accept bookings. New doctor accounts start with a free trial. When a subscription
        is not active, the doctor stops appearing to patients and cannot take new bookings; their
        existing records remain intact.
      </p>
      <p>
        Prices are in US dollars and shown before payment. We may change the price, and will give
        notice before a change affects an existing subscriber. Patients pay nothing to use{' '}
        {org.product}; any fee for medical care is agreed directly with the doctor.
      </p>

      <h2>5. Acceptable use</h2>
      <ul>
        <li>Do not use the service to harass anyone or to submit false or misleading information.</li>
        <li>Do not attempt to access records that are not yours, or to disrupt the service.</li>
        <li>Do not book appointments you do not intend to attend, or list yourself as a doctor without the qualifications to practise.</li>
      </ul>

      <h2>6. Availability</h2>
      <p>
        We work to keep {org.product} available, but it is provided as-is and we do not guarantee
        uninterrupted service. Maintenance, outages of providers we rely on, or events outside our
        control may interrupt access.
      </p>

      <h2>7. Limits on liability</h2>
      <p>
        To the extent permitted by law, {provider} is not liable for indirect or consequential loss
        arising from your use of {org.product}, nor for the medical care provided by a doctor found
        through the service. Nothing here limits liability that cannot legally be limited.
      </p>

      <h2>8. Ending your use</h2>
      <p>
        You may stop using {org.product} and close your account at any time. Doctors can cancel a
        subscription as described in our{' '}
        <a href="/refund-policy">Refunds &amp; Cancellation Policy</a>. We may end access where these
        terms are broken, or where required by law.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these terms. Where a change is significant we will give notice in the app or
        by email. Continuing to use the service after a change means you accept the updated terms.
      </p>

      <h2>10. Governing law and contact</h2>
      <p>
        These terms are governed by the laws of Lebanon. For any question about them, contact{' '}
        <a href={`mailto:${org.email}`}>{org.email}</a>
        {org.phone ? <> or {org.phone}</> : null}.
      </p>
    </>
  )
}
