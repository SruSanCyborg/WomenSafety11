import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import type { SOSEvent, SOSStatus, IncidentReport, BuddyAvailability } from '../../types'

const statusBadge: Record<SOSStatus, string> = {
  triggered: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  level_1: 'bg-orange-600/20 text-orange-300 border border-orange-600/30',
  level_2: 'bg-red-600/20 text-red-400 border border-red-500/30',
  level_3: 'bg-red-900/40 text-red-300 border border-red-500/50 animate-pulse',
  resolved: 'bg-green-600/20 text-green-400 border border-green-600/30',
  false_alarm: 'bg-gray-600/20 text-gray-400 border border-gray-600/30',
}

const categoryIcon: Record<string, string> = {
  harassment: '😠',
  suspicious: '👀',
  unsafe_area: '⚠️',
  other: '📝',
}

type Tab = 'sos' | 'incidents' | 'buddies' | 'history'

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('sos')
  const [activeSOS, setActiveSOS] = useState<SOSEvent[]>([])
  const [allSOS, setAllSOS] = useState<SOSEvent[]>([])
  const [incidents, setIncidents] = useState<IncidentReport[]>([])
  const [buddies, setBuddies] = useState<BuddyAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [elapsedTick, setElapsedTick] = useState(0)

  // Tick every second to update elapsed timers
  useEffect(() => {
    const t = setInterval(() => setElapsedTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    fetchAll()

    const channel = supabase
      .channel('admin:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_events' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incident_reports' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buddy_availability' }, fetchAll)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchAll() {
    const [sosRes, allSosRes, incRes, buddyRes] = await Promise.all([
      supabase.from('sos_events').select('*, user:user_id(full_name, phone)').not('status', 'in', '(resolved,false_alarm)').order('triggered_at', { ascending: false }),
      supabase.from('sos_events').select('*, user:user_id(full_name, phone)').order('triggered_at', { ascending: false }).limit(20),
      supabase.from('incident_reports').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('buddy_availability').select('*, profile:user_id(full_name)').eq('is_available', true),
    ])
    setActiveSOS(sosRes.data ?? [])
    setAllSOS(allSosRes.data ?? [])
    setIncidents(incRes.data ?? [])
    setBuddies(buddyRes.data ?? [])
    setLoading(false)
  }

  async function acknowledgeResolve(sosId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('sos_events')
      .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: user.id })
      .eq('id', sosId)
    fetchAll()
  }

  async function updateIncidentStatus(id: string, status: 'verified' | 'dismissed') {
    await supabase.from('incident_reports').update({ status }).eq('id', id)
    fetchAll()
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'sos', label: '🚨 Live SOS', count: activeSOS.length },
    { key: 'incidents', label: '⚠️ Reports', count: incidents.filter(i => i.status === 'pending').length },
    { key: 'buddies', label: '👥 Buddies', count: buddies.length },
    { key: 'history', label: '📋 History' },
  ]

  return (
    <div className="h-full">
      {/* Header stats */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black text-white">Control Center</h1>
          <p className="text-gray-400 text-sm">SafeHer Campus — Live Dashboard</p>
        </div>
        <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-full border border-gray-700">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-green-400 font-medium">Live</span>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Active SOS', value: activeSOS.length, color: activeSOS.length > 0 ? 'text-red-400' : 'text-green-400', bg: activeSOS.length > 0 ? 'bg-red-900/30 border-red-700/30' : 'bg-gray-800 border-gray-700' },
          { label: 'Pending Reports', value: incidents.filter(i => i.status === 'pending').length, color: 'text-orange-400', bg: 'bg-gray-800 border-gray-700' },
          { label: 'Buddies Online', value: buddies.length, color: 'text-green-400', bg: 'bg-gray-800 border-gray-700' },
          { label: 'Total SOS Today', value: allSOS.filter(s => new Date(s.triggered_at).toDateString() === new Date().toDateString()).length, color: 'text-blue-400', bg: 'bg-gray-800 border-gray-700' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 border text-center`}>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-gray-500 text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800 p-1 rounded-xl mb-5 border border-gray-700">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-colors relative ${tab === t.key ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}

      {/* Live SOS Tab */}
      {tab === 'sos' && !loading && (
        <div className="space-y-4">
          {activeSOS.length === 0 ? (
            <div className="bg-gray-800 rounded-2xl p-12 text-center border border-gray-700">
              <p className="text-5xl mb-3">✅</p>
              <p className="text-white font-bold text-lg">All Clear</p>
              <p className="text-gray-400 text-sm mt-1">No active emergencies on campus.</p>
            </div>
          ) : (
            activeSOS.map(sos => (
              <SOSCard key={sos.id} sos={sos} tick={elapsedTick} onResolve={acknowledgeResolve} />
            ))
          )}
        </div>
      )}

      {/* Incident Reports Tab */}
      {tab === 'incidents' && !loading && (
        <div className="space-y-3">
          {incidents.length === 0 ? (
            <EmptyState icon="⚠️" text="No incident reports yet." />
          ) : (
            incidents.map(inc => (
              <div key={inc.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{categoryIcon[inc.category] ?? '📝'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold text-sm capitalize">{inc.category.replace('_', ' ')}</span>
                      <span className={`badge text-xs ${inc.status === 'pending' ? 'bg-yellow-900/40 text-yellow-400' : inc.status === 'verified' ? 'bg-green-900/40 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                        {inc.status}
                      </span>
                      <span className="text-gray-500 text-xs ml-auto">Severity {inc.severity}/5</span>
                    </div>
                    <p className="text-gray-300 text-sm">{inc.description}</p>
                    {inc.location_name && <p className="text-gray-500 text-xs mt-1">📍 {inc.location_name}</p>}
                    <p className="text-gray-600 text-xs mt-1">{new Date(inc.created_at).toLocaleString()}</p>
                  </div>
                </div>
                {inc.status === 'pending' && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => updateIncidentStatus(inc.id, 'verified')}
                      className="flex-1 bg-green-700/30 hover:bg-green-700/50 border border-green-600/40 text-green-400 text-xs font-semibold py-2 rounded-lg transition-colors">
                      ✓ Verify
                    </button>
                    <button onClick={() => updateIncidentStatus(inc.id, 'dismissed')}
                      className="flex-1 bg-gray-700/30 hover:bg-gray-700/50 border border-gray-600/40 text-gray-400 text-xs font-semibold py-2 rounded-lg transition-colors">
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Buddies Tab */}
      {tab === 'buddies' && !loading && (
        <div className="space-y-3">
          {buddies.length === 0 ? (
            <EmptyState icon="👥" text="No campus buddies available right now." />
          ) : (
            buddies.map(b => (
              <div key={b.user_id} className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-xl">👤</div>
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">{(b as any).profile?.full_name ?? 'Campus Buddy'}</p>
                  <p className="text-gray-500 text-xs">Last seen: {new Date(b.last_seen).toLocaleTimeString()}</p>
                </div>
                <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
              </div>
            ))
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && !loading && (
        <div className="space-y-2">
          {allSOS.map(sos => (
            <div key={sos.id} className="bg-gray-800 rounded-xl p-3 border border-gray-700 flex items-center gap-3">
              <span className={`badge ${statusBadge[sos.status]} text-xs uppercase font-bold w-24 justify-center`}>
                {sos.status.replace('_', ' ')}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{(sos as any).user?.full_name ?? 'Unknown'}</p>
                <p className="text-gray-500 text-xs">{new Date(sos.triggered_at).toLocaleString()}</p>
              </div>
              <span className="text-gray-500 text-xs capitalize">{sos.trigger_method}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SOSCard({ sos, tick, onResolve }: { sos: SOSEvent; tick: number; onResolve: (id: string) => void }) {
  const elapsed = Math.floor((Date.now() - new Date(sos.triggered_at).getTime()) / 1000)
  const elapsedStr = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`

  return (
    <div className={`rounded-2xl p-5 border ${sos.status === 'level_3' ? 'bg-red-950/50 border-red-700/50' : 'bg-gray-800 border-gray-700'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`badge ${statusBadge[sos.status]} uppercase text-xs font-bold px-3`}>
              {sos.status.replace('_', ' ')}
            </span>
            <span className="text-gray-400 text-xs font-mono">{elapsedStr}</span>
          </div>
          <p className="text-white font-bold text-lg">{(sos as any).user?.full_name ?? 'Unknown User'}</p>
          <p className="text-gray-400 text-sm">{(sos as any).user?.phone ?? 'No phone on record'}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-gray-500 mb-0.5">Trigger</p>
          <p className="text-sm text-gray-300 capitalize bg-gray-700 px-2 py-0.5 rounded-lg">{sos.trigger_method}</p>
        </div>
      </div>

      {(sos.location_name || (sos.latitude && sos.longitude)) && (
        <div className="bg-gray-700/50 rounded-lg p-2 mb-3 flex items-center gap-2">
          <span>📍</span>
          <p className="text-gray-300 text-sm">
            {sos.location_name ?? `${sos.latitude?.toFixed(5)}, ${sos.longitude?.toFixed(5)}`}
          </p>
        </div>
      )}

      {/* Escalation timeline */}
      <div className="flex items-center gap-2 mb-4">
        {(['triggered','level_1','level_2','level_3'] as SOSStatus[]).map((lvl, i) => {
          const reached = ['triggered','level_1','level_2','level_3'].indexOf(sos.status) >= i
          return (
            <div key={lvl} className="flex items-center gap-1 flex-1">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${reached ? 'bg-red-400' : 'bg-gray-600'}`} />
              {i < 3 && <div className={`h-0.5 flex-1 ${reached ? 'bg-red-700' : 'bg-gray-700'}`} />}
            </div>
          )
        })}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onResolve(sos.id)}
          className="flex-1 bg-green-600/20 hover:bg-green-600/40 border border-green-600/40 text-green-400 font-semibold py-2.5 rounded-xl transition-colors text-sm"
        >
          ✓ Mark Resolved
        </button>
        {sos.latitude && sos.longitude && (
          <a
            href={`https://www.google.com/maps?q=${sos.latitude},${sos.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-600/40 text-blue-400 font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            🗺 Map
          </a>
        )}
      </div>
    </div>
  )
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="bg-gray-800 rounded-2xl p-12 text-center border border-gray-700">
      <p className="text-4xl mb-3">{icon}</p>
      <p className="text-gray-400 text-sm">{text}</p>
    </div>
  )
}
