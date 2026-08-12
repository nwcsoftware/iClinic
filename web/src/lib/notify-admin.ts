// ---------------------------------------------------------------------------
// Admin alerts.
//
// With Whish and OMT the money arrives outside the app, so a doctor is blocked
// until someone approves their payment. That makes speed the whole product:
// this fires the moment a payment is reported so it can be approved in seconds
// rather than whenever the admin console next gets opened.
//
// Sending is best-effort. A failed email must never fail the doctor's report —
// losing the claim would be far worse than losing the notification.
// ---------------------------------------------------------------------------

const RESEND = 'https://api.resend.com/emails'

export function adminNotifyEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && recipient())
}

function recipient(): string | null {
  return process.env.ADMIN_NOTIFY_EMAIL || null
}

export async function notifyAdmin(input: {
  subject: string
  heading: string
  lines: { label: string; value: string }[]
  actionUrl?: string
  actionLabel?: string
}): Promise<{ sent: boolean; error?: string }> {
  const to = recipient()
  if (!process.env.RESEND_API_KEY || !to) {
    return { sent: false, error: 'not configured' }
  }

  const rows = input.lines
    .map((l) => `
      <tr>
        <td style="padding:6px 14px 6px 0;color:#5B6577;font-size:13px;white-space:nowrap">${esc(l.label)}</td>
        <td style="padding:6px 0;color:#0D1526;font-size:14px;font-weight:600">${esc(l.value)}</td>
      </tr>`)
    .join('')

  const button = input.actionUrl
    ? `<a href="${esc(input.actionUrl)}" style="display:inline-block;margin-top:22px;background:#0F766E;color:#fff;
         text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:700;font-size:15px">
         ${esc(input.actionLabel ?? 'Open')}</a>`
    : ''

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F5F6FA;padding:24px">
      <div style="max-width:460px;margin:0 auto;background:#fff;border-radius:16px;padding:24px">
        <h1 style="margin:0 0 16px;font-size:19px;color:#0D1526">${esc(input.heading)}</h1>
        <table style="border-collapse:collapse">${rows}</table>
        ${button}
      </div>
    </div>`

  try {
    const res = await fetch(RESEND, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
        to: [to],
        subject: input.subject,
        html,
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.error('notifyAdmin: Resend rejected', body)
      return { sent: false, error: 'send failed' }
    }
    return { sent: true }
  } catch (err) {
    console.error('notifyAdmin error:', err)
    return { sent: false, error: 'send failed' }
  }
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
