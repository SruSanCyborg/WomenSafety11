import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import SOSButton from '../components/sos/SOSButton'
import { supabase } from '../lib/supabase'
import { detectShake } from '../lib/geolocation'
import { useSOSContext } from '../contexts/SOSContext'
import type { CheckinSchedule } from '../types'

export default function Home() {
  const { profile } = useAuth()
  const { triggerSOS } = useSOSContext()
  const [activeSchedule, setActiveSchedule] = useState<CheckinSchedule | null>(null)
  const [shakeEnabled, setShakeEnabled] = useState(false)

  useEffect(() => {
    // Load active check-in schedule
    supabase
      .from('checkin_schedules')
      .select('*')
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => setActiveSchedule(data))
  }, [])

  useEffect(() => {
    if (!shakeEnabled) return
    const stop = detectShake(() => triggerSOS('shake'))
    return stop
  }, [shakeEnabled, triggerSOS])

  return (
    <div className="flex flex-col items-center pt-6 gap-6">
      {/* Greeting */}
      <div className="text-center">
        <h1 className="text-xl font-bold text-gray-800">
          Hi, {profile?.full_name?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className="text-sm text-gray-500">You are safe. Stay aware.</p>
      </div>

      {/* SOS Button — core feature */}
      <SOSButton />

      {/* Quick actions */}
      <div className="w-full grid grid-cols-2 gap-3">
        <QuickCard
          icon="📍"
          title="Safe Check-in"
          desc={activeSchedule ? `Active: every ${activeSchedule.interval_min}min` : 'No active schedule'}
          href="/schedule"
        />
        <QuickCard
          icon="👥"
          title="Campus Buddy"
          desc="Find a peer escort"
          href="/community"
        />
        <QuickCard
          icon="⚠️"
          title="Report Incident"
          desc="Anonymous or identified"
          href="/incidents"
        />
        <QuickCard
          icon="🗺️"
          title="Safe Routes"
          desc="View campus risk zones"
          href="/map"
        />
      </div>

      {/* Shake detection toggle */}
      <div className="w-full card flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm text-gray-800">Shake to SOS</p>
          <p className="text-xs text-gray-500">Shake your phone 3× to trigger alert</p>
        </div>
        <button
          onClick={() => setShakeEnabled((v) => !v)}
          className={`w-12 h-6 rounded-full transition-colors relative ${shakeEnabled ? 'bg-primary-600' : 'bg-gray-300'}`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${shakeEnabled ? 'translate-x-6' : 'translate-x-0.5'}`}
          />
        </button>
      </div>

      {/* Trusted contacts count */}
      <TrustedContactsSummary />
    </div>
  )
}

function QuickCard({ icon, title, desc, href }: { icon: string; title: string; desc: string; href: string }) {
  return (
    <a href={href} className="card flex flex-col gap-1 hover:shadow-md transition-shadow cursor-pointer">
      <span className="text-2xl">{icon}</span>
      <span className="font-semibold text-sm text-gray-800">{title}</span>
      <span className="text-xs text-gray-500">{desc}</span>
    </a>
  )
}

function TrustedContactsSummary() {
  const { user } = useAuth()
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('trusted_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count }) => setCount(count ?? 0))
  }, [user])

  return (
    <a href="/profile" className="w-full card flex items-center gap-3 hover:shadow-md transition-shadow">
      <div className="text-2xl">📋</div>
      <div>
        <p className="font-semibold text-sm text-gray-800">Trusted Contacts</p>
        <p className="text-xs text-gray-500">
          {count === null ? 'Loading...' : count === 0 ? 'No contacts added yet — add some!' : `${count} contact${count !== 1 ? 's' : ''} configured`}
        </p>
      </div>
      <span className="ml-auto text-gray-400">›</span>
    </a>
  )
}
