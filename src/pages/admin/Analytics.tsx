import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { supabase } from '../../lib/supabase'
import type { SOSEvent, IncidentReport } from '../../types'

const PIE_COLORS = ['#ef4444', '#f97316', '#eab308', '#6b7280']

export default function Analytics() {
  const [sosEvents, setSosEvents] = useState<SOSEvent[]>([])
  const [incidents, setIncidents] = useState<IncidentReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('sos_events').select('*').order('triggered_at', { ascending: false }).limit(200),
      supabase.from('incident_reports').select('*').order('created_at', { ascending: false }).limit(200),
    ]).then(([sos, inc]) => {
      setSosEvents(sos.data ?? [])
      setIncidents(inc.data ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="text-gray-400">Loading analytics...</p>

  // SOS by status
  const statusCounts = sosEvents.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }))

  // Avg response time (triggered → level_1)
  const responseTimes = sosEvents
    .filter((e) => e.level_1_at)
    .map((e) => (new Date(e.level_1_at!).getTime() - new Date(e.triggered_at).getTime()) / 1000)
  const avgResponseTime =
    responseTimes.length > 0 ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(0) : '—'

  // Incident categories
  const catCounts = incidents.reduce((acc, i) => {
    acc[i.category] = (acc[i.category] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  const catData = Object.entries(catCounts).map(([name, value]) => ({ name, value }))

  // False alarm rate
  const falseAlarms = sosEvents.filter((e) => e.status === 'false_alarm').length
  const falseAlarmRate = sosEvents.length > 0 ? ((falseAlarms / sosEvents.length) * 100).toFixed(1) : '0'

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-6">Analytics</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total SOS Events', value: sosEvents.length, icon: '🚨' },
          { label: 'Avg Response (s)', value: avgResponseTime, icon: '⏱️' },
          { label: 'False Alarm Rate', value: `${falseAlarmRate}%`, icon: '❌' },
          { label: 'Total Incidents', value: incidents.length, icon: '⚠️' },
        ].map((card) => (
          <div key={card.label} className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
            <p className="text-2xl mb-1">{card.icon}</p>
            <p className="text-2xl font-black text-white">{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SOS Status breakdown */}
        <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
          <h2 className="font-semibold text-white mb-4">SOS Events by Status</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusData}>
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
              <Bar dataKey="value" fill="#db2777" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Incident categories pie */}
        <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
          <h2 className="font-semibold text-white mb-4">Incident Categories</h2>
          {catData.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-12">No incident data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {catData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
