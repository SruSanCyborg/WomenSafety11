import emailjs from '@emailjs/browser'

emailjs.init(import.meta.env.VITE_EMAILJS_PUBLIC_KEY)

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID

const levelLabels: Record<string, string> = {
  level_1: '🔴 ALERT',
  level_2: '🚨 URGENT',
  level_3: '🆘 EMERGENCY',
}

export async function notifyTrustedContacts(
  contacts: { name: string; email: string | null }[],
  userName: string,
  location: string,
  level: string,
  sosId: string
) {
  const label = levelLabels[level] ?? 'ALERT'
  const emailContacts = contacts.filter((c) => c.email)

  await Promise.allSettled(
    emailContacts.map((contact) =>
      emailjs.send(SERVICE_ID, TEMPLATE_ID, {
        subject: `${label} — ${userName} needs help NOW`,
        to_name: contact.name,
        to_email: contact.email,
        message: `
${label} — SafeHer Campus Emergency Alert

${userName} has triggered an emergency SOS and needs help.

📍 Location: ${location}
⏰ Time: ${new Date().toLocaleString()}
🚨 Alert Level: ${level.replace('_', ' ').toUpperCase()}

Please respond immediately or contact campus security.

This alert was sent by SafeHer Campus Safety Platform.
SOS ID: ${sosId}
        `.trim(),
      })
    )
  )
}
