import type { Metadata } from 'next'
import { org } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Refunds & Cancellation | iClinic',
  description: 'How doctors cancel an iClinic subscription and when a refund is given.',
}

export default function RefundPolicyPage() {
  return (
    <>
      <h1>Refunds &amp; Cancellation</h1>
      <p>
        This policy covers the <strong>${org.priceUsd.toFixed(2)} per month</strong> doctor
        subscription to {org.product}. Patients are not charged to use {org.product}, so nothing
        here applies to them. Any fee for medical care is a matter between the patient and the
        doctor.
      </p>

      <h2>Free trial</h2>
      <p>
        New doctor accounts include a free trial. You are not charged during the trial, and if you
        do nothing at the end of it your account simply stops appearing to patients. You do not need
        to cancel a trial to avoid being billed.
      </p>

      <h2>Cancelling</h2>
      <p>
        You can cancel at any time from <strong>Billing &amp; payments</strong> in the app, or by
        emailing <a href={`mailto:${org.email}`}>{org.email}</a>. Cancelling stops the subscription
        renewing; it does not cut short the period you have already paid for.
      </p>
      <p>
        <strong>You keep full access until the end of your paid period.</strong> After that your
        profile stops appearing to patients and you cannot take new bookings. Your account, patient
        records and prescription history are kept, and reactivating restores access to them.
      </p>

      <h2>Refunds</h2>
      <p>We refund in these cases:</p>
      <ul>
        <li>
          <strong>Within 14 days of a first payment:</strong> if {org.product} is not right for
          you, tell us within 14 days of your first charge and we will refund it in full.
        </li>
        <li>
          <strong>Duplicate or incorrect charges:</strong> if you were charged twice, or charged
          after cancelling, we refund the difference in full.
        </li>
        <li>
          <strong>Extended service failure:</strong> if {org.product} is unavailable for a
          prolonged period through our fault, we refund or credit the affected time.
        </li>
      </ul>
      <p>
        Outside those cases we do not refund part of a month that has already started, since the
        subscription remains fully usable until the period ends.
      </p>

      <h2>How to request a refund</h2>
      <p>
        Email <a href={`mailto:${org.email}`}>{org.email}</a> with the email address on your
        account and, if you have it, the payment reference. We aim to reply within 2 working days.
        Approved refunds are returned by the same method you paid with, and typically take 5–10
        working days to appear depending on your bank or wallet provider.
      </p>

      <h2>Payments made by transfer</h2>
      <p>
        Where you pay by Whish, OMT or bank transfer, your account is activated once we confirm the
        payment. If you reported a payment that we cannot find, we will contact you before doing
        anything, and you will not be charged again.
      </p>

      <h2>Questions</h2>
      <p>
        Contact <a href={`mailto:${org.email}`}>{org.email}</a>
        {org.phone ? <> or {org.phone}</> : null} and we will help.
      </p>
    </>
  )
}
