// Supabase Edge Function — Deno runtime
// Deploy: supabase functions deploy escalation-engine

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  const { sos_id } = await req.json()

  const { data: sos } = await supabase
    .from('sos_events')
    .select('*, user:user_id(*)')
    .eq('id', sos_id)
    .single()

  if (!sos || sos.status === 'resolved' || sos.status === 'false_alarm') {
    return new Response('ok', { status: 200 })
  }

  const elapsed = Date.now() - new Date(sos.triggered_at).getTime()

  if (elapsed >= 180_000 && sos.status !== 'level_3') {
    await escalateTo(sos, 'level_3')
  } else if (elapsed >= 60_000 && sos.status === 'level_1') {
    await escalateTo(sos, 'level_2')
  } else if (sos.status === 'triggered') {
    await escalateTo(sos, 'level_1')
  }

  return new Response('ok', { status: 200 })
})

async function escalateTo(sos: any, level: string) {
  await supabase
    .from('sos_events')
    .update({ status: level, [`${level}_at`]: new Date().toISOString() })
    .eq('id', sos.id)

  const responders = await getResponders(sos, level)
  if (responders.length > 0) {
    await supabase.from('responder_dispatches').insert(responders)
  }

  await insertNotifications(sos, level, responders)
}

async function getResponders(sos: any, level: string) {
  if (level === 'level_1') {
    const { data } = await supabase
      .from('trusted_contacts')
      .select('*')
      .eq('user_id', sos.user_id)
      .order('priority')
    return (data ?? []).map((c: any) => ({
      sos_id: sos.id,
      responder_id: sos.user_id, // placeholder — in prod map to actual user IDs
      dispatch_type: 'trusted_contact',
    }))
  }
  if (level === 'level_2') {
    const { data } = await supabase.from('profiles').select('id').eq('role', 'security')
    return (data ?? []).map((c: any) => ({
      sos_id: sos.id,
      responder_id: c.id,
      dispatch_type: 'security',
    }))
  }
  if (level === 'level_3') {
    const { data } = await supabase.from('profiles').select('id').in('role', ['security', 'admin'])
    return (data ?? []).map((c: any) => ({
      sos_id: sos.id,
      responder_id: c.id,
      dispatch_type: 'admin',
    }))
  }
  return []
}

async function insertNotifications(sos: any, level: string, responders: any[]) {
  const labels: Record<string, string> = { level_1: 'ALERT', level_2: 'URGENT', level_3: 'EMERGENCY' }
  const label = labels[level] ?? level.toUpperCase()
  const userName = sos.user?.full_name ?? 'A user'

  const notifRows = responders.map((r) => ({
    user_id: r.responder_id,
    sos_id: sos.id,
    type: 'sos_alert',
    title: `${label} — SafeHer Campus`,
    body: `${userName} needs help at ${sos.location_name ?? 'campus'}`,
  }))

  if (notifRows.length > 0) {
    await supabase.from('notifications').insert(notifRows)
  }
}
