import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentPosition } from '../lib/geolocation'
import { notifyTrustedContacts } from '../lib/emailNotify'
import type { SOSStatus, TriggerMethod } from '../types'

// Escalation thresholds in milliseconds
const LEVEL_1_MS = 0        // immediate
const LEVEL_2_MS = 60_000   // 60 seconds
const LEVEL_3_MS = 180_000  // 3 minutes

export function useSOS() {
  const [status, setStatus] = useState<SOSStatus | 'idle'>('idle')
  const [sosId, setSosId] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(10)
  const [showGrace, setShowGrace] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const graceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const escalationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const sosIdRef = useRef<string | null>(null)

  // Keep ref in sync so escalation callbacks always have latest sosId
  useEffect(() => { sosIdRef.current = sosId }, [sosId])

  const triggerSOS = useCallback(async (method: TriggerMethod = 'button') => {
    setShowGrace(true)
    setCountdown(10)

    let count = 10
    graceTimerRef.current = setInterval(() => {
      count -= 1
      setCountdown(count)
      if (count <= 0) {
        clearInterval(graceTimerRef.current!)
        setShowGrace(false)
        _fireSOS(method)
      }
    }, 1000)
  }, [])

  async function _fireSOS(method: TriggerMethod) {
    try {
      const coords = await getCurrentPosition().catch(() => null)
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        console.error('No user session')
        return
      }

      const { data, error } = await supabase
        .from('sos_events')
        .insert({
          user_id: user.id,
          trigger_method: method,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          status: 'triggered',
        })
        .select()
        .single()

      if (error || !data) {
        console.error('SOS trigger failed:', error)
        return
      }

      setSosId(data.id)
      sosIdRef.current = data.id
      setStatus('triggered')

      // Subscribe to real-time updates (for when admin resolves from dashboard)
      channelRef.current = supabase
        .channel(`sos:${data.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'sos_events',
            filter: `id=eq.${data.id}`,
          },
          (payload) => {
            setStatus((payload.new as { status: SOSStatus }).status)
          }
        )
        .subscribe()

      // Client-side escalation engine
      _scheduleEscalation(data.id)
    } catch (err) {
      console.error('Error firing SOS:', err)
    }
  }

  function _scheduleEscalation(id: string) {
    _clearEscalationTimers()

    // Level 1 — immediate: notify trusted contacts
    const t1 = setTimeout(() => _escalate(id, 'level_1'), LEVEL_1_MS + 100)

    // Level 2 — 60s: escalate to campus security
    const t2 = setTimeout(() => _escalate(id, 'level_2'), LEVEL_2_MS)

    // Level 3 — 3min: full campus broadcast
    const t3 = setTimeout(() => _escalate(id, 'level_3'), LEVEL_3_MS)

    escalationTimersRef.current = [t1, t2, t3]
  }

  async function _escalate(id: string, level: SOSStatus) {
    // Don't escalate if already resolved/cancelled
    const { data: current } = await supabase
      .from('sos_events')
      .select('status')
      .eq('id', id)
      .single()

    if (!current || current.status === 'resolved' || current.status === 'false_alarm') return

    await supabase
      .from('sos_events')
      .update({ status: level, [`${level}_at`]: new Date().toISOString() })
      .eq('id', id)

    setStatus(level)

    // Get sos row for user_id
    const { data: sosRow } = await supabase
      .from('sos_events')
      .select('user_id')
      .eq('id', id)
      .single()

    if (sosRow?.user_id) {
      const labels: Record<string, string> = {
        level_1: '🔴 ALERT — Trusted contacts notified',
        level_2: '🚨 URGENT — Campus security alerted',
        level_3: '🆘 EMERGENCY — Full campus broadcast activated',
      }

      // In-app notification
      await supabase.from('notifications').insert({
        user_id: sosRow.user_id,
        sos_id: id,
        type: 'sos_alert',
        title: labels[level] ?? level,
        body: 'Your SOS has escalated. Help is on the way.',
      })

      // Email trusted contacts via EmailJS
      const { data: contacts } = await supabase
        .from('trusted_contacts')
        .select('name, email')
        .eq('user_id', sosRow.user_id)
        .order('priority')

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', sosRow.user_id)
        .single()

      const { data: sosLocation } = await supabase
        .from('sos_events')
        .select('location_name, latitude, longitude')
        .eq('id', id)
        .single()

      const location = sosLocation?.location_name
        ?? (sosLocation?.latitude ? `${sosLocation.latitude.toFixed(4)}, ${sosLocation.longitude?.toFixed(4)}` : 'Unknown location')

      if (contacts && contacts.length > 0) {
        notifyTrustedContacts(
          contacts,
          profile?.full_name ?? 'A user',
          location,
          level,
          id
        ).catch(err => console.warn('Email notify failed:', err))
      }
    }
  }

  function _clearEscalationTimers() {
    escalationTimersRef.current.forEach(clearTimeout)
    escalationTimersRef.current = []
  }

  const cancelSOS = useCallback(() => {
    if (graceTimerRef.current) {
      clearInterval(graceTimerRef.current)
      graceTimerRef.current = null
    }
    _clearEscalationTimers()
    setShowGrace(false)
    setCountdown(10)
    setStatus('idle')
  }, [])

  const cancelActiveSOSAsFalseAlarm = useCallback(async () => {
    if (!sosIdRef.current) return
    _clearEscalationTimers()
    await supabase
      .from('sos_events')
      .update({ status: 'false_alarm' })
      .eq('id', sosIdRef.current)
    setStatus('false_alarm')
    if (channelRef.current) supabase.removeChannel(channelRef.current)
  }, [])

  const reset = useCallback(() => {
    _clearEscalationTimers()
    setStatus('idle')
    setSosId(null)
    sosIdRef.current = null
    if (channelRef.current) supabase.removeChannel(channelRef.current)
  }, [])

  useEffect(() => {
    return () => {
      if (graceTimerRef.current) clearInterval(graceTimerRef.current)
      _clearEscalationTimers()
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  return {
    status,
    sosId,
    countdown,
    showGrace,
    triggerSOS,
    cancelSOS,
    cancelActiveSOSAsFalseAlarm,
    reset,
  }
}
