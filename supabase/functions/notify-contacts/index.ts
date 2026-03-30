import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

Deno.serve(async (req) => {
  const { sos_id, level } = await req.json()

  // Get SOS event + user info
  const { data: sos } = await supabase
    .from('sos_events')
    .select('*, user:user_id(full_name, phone)')
    .eq('id', sos_id)
    .single()

  if (!sos) return new Response('SOS not found', { status: 404 })

  // Get trusted contacts for this user
  const { data: contacts } = await supabase
    .from('trusted_contacts')
    .select('*')
    .eq('user_id', sos.user_id)
    .order('priority')

  if (!contacts || contacts.length === 0) {
    return new Response('No contacts', { status: 200 })
  }

  const userName = (sos.user as any)?.full_name ?? 'Someone'
  const location = sos.location_name ?? `${sos.latitude?.toFixed(4)}, ${sos.longitude?.toFixed(4)}` ?? 'Unknown location'

  const levelLabels: Record<string, string> = {
    level_1: '🔴 ALERT',
    level_2: '🚨 URGENT',
    level_3: '🆘 EMERGENCY',
  }
  const levelLabel = levelLabels[level] ?? 'ALERT'

  const subject = `${levelLabel} — ${userName} needs help`
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <div style="background:#ef4444;color:white;padding:16px 24px;border-radius:12px;text-align:center">
        <h1 style="margin:0;font-size:28px">${levelLabel}</h1>
        <p style="margin:8px 0 0;font-size:16px">SafeHer Campus Emergency Alert</p>
      </div>
      <div style="padding:24px 0">
        <p style="font-size:18px;font-weight:bold;color:#111">${userName} has triggered an emergency SOS.</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <tr>
            <td style="padding:8px;color:#555;font-weight:bold">Location</td>
            <td style="padding:8px;color:#111">${location}</td>
          </tr>
          <tr style="background:#f9f9f9">
            <td style="padding:8px;color:#555;font-weight:bold">Time</td>
            <td style="padding:8px;color:#111">${new Date(sos.triggered_at).toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding:8px;color:#555;font-weight:bold">Alert Level</td>
            <td style="padding:8px;color:#ef4444;font-weight:bold">${level.replace('_', ' ').toUpperCase()}</td>
          </tr>
        </table>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-top:20px">
          <p style="margin:0;color:#991b1b;font-weight:bold">Please respond immediately or contact campus security.</p>
        </div>
      </div>
      <p style="color:#999;font-size:12px;text-align:center">Sent by SafeHer Campus Safety Platform</p>
    </div>
  `

  // Send to all contacts with email
  const emailContacts = contacts.filter(c => c.email)
  const results = await Promise.allSettled(
    emailContacts.map(contact =>
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'SafeHer Campus <onboarding@resend.dev>',
          to: contact.email,
          subject,
          html,
        }),
      })
    )
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  return new Response(JSON.stringify({ sent, total: emailContacts.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
