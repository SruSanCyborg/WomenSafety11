import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../types'

type AdminTab = 'users' | 'routes' | 'system'

export default function AdminSettings() {
  const [tab, setTab] = useState<AdminTab>('users')
  const [users, setUsers] = useState<Profile[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sendingReset, setSendingReset] = useState<string | null>(null)
  const [resetDone, setResetDone] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('safe_routes').select('*').order('created_at', { ascending: false }),
    ]).then(([u, r]) => {
      setUsers(u.data ?? [])
      setRoutes(r.data ?? [])
      setLoading(false)
    })
  }, [])

  async function updateRole(userId: string, role: string) {
    await supabase.from('profiles').update({ role }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: role as any } : u))
  }

  async function verifyUser(userId: string, verified: boolean) {
    await supabase.from('profiles').update({ is_verified: verified }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_verified: verified } : u))
  }

  async function sendPasswordReset(email: string, userId: string) {
    setSendingReset(userId)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setSendingReset(null)
    setResetDone(userId)
    setTimeout(() => setResetDone(null), 3000)
  }

  async function verifyRoute(id: string, verified: boolean) {
    await supabase.from('safe_routes').update({ is_verified: verified }).eq('id', id)
    setRoutes(prev => prev.map(r => r.id === id ? { ...r, is_verified: verified } : r))
  }

  async function deleteRoute(id: string) {
    await supabase.from('safe_routes').delete().eq('id', id)
    setRoutes(prev => prev.filter(r => r.id !== id))
  }

  const filtered = users.filter(u =>
    (u.full_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const tabs: { key: AdminTab; label: string }[] = [
    { key: 'users', label: '👤 Users' },
    { key: 'routes', label: '🛤 Routes' },
    { key: 'system', label: '⚙️ System' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-1">Admin Panel</h1>
      <p className="text-gray-400 text-sm mb-5">Manage users, routes, and system settings</p>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800 p-1 rounded-xl mb-5 border border-gray-700">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === t.key ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total', value: users.length },
              { label: 'Students', value: users.filter(u => u.role === 'student').length },
              { label: 'Security', value: users.filter(u => u.role === 'security').length },
              { label: 'Verified', value: users.filter(u => u.is_verified).length },
            ].map(s => (
              <div key={s.label} className="bg-gray-800 rounded-xl p-3 border border-gray-700 text-center">
                <p className="text-xl font-black text-white">{s.value}</p>
                <p className="text-gray-500 text-xs">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <input type="text" placeholder="Search by name..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-gray-500" />

          {/* User list */}
          {loading ? <p className="text-gray-500 text-sm">Loading...</p> : (
            <div className="space-y-3">
              {filtered.map(user => (
                <div key={user.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-lg flex-shrink-0">
                      {user.avatar_url ? <img src={user.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" /> : '👤'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{user.full_name ?? 'Unnamed'}</p>
                      <p className="text-gray-400 text-xs">{user.campus_id ?? 'No campus ID'} {user.hostel_block ? `· ${user.hostel_block}` : ''}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {user.is_verified
                          ? <span className="text-xs text-green-400">✅ Verified</span>
                          : <span className="text-xs text-yellow-400">⏳ Unverified</span>}
                        <span className="text-gray-600">·</span>
                        <span className="text-xs text-gray-400">
                          Joined {new Date(user.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Role selector */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Role</p>
                      <select value={user.role}
                        onChange={e => updateRole(user.id, e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none">
                        <option value="student">Student</option>
                        <option value="faculty">Faculty</option>
                        <option value="security">Security</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>

                    {/* Verify toggle */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Campus Verified</p>
                      <button onClick={() => verifyUser(user.id, !user.is_verified)}
                        className={`w-full text-xs font-semibold py-1.5 rounded-lg border transition-colors ${user.is_verified
                          ? 'bg-green-900/30 border-green-700/40 text-green-400'
                          : 'bg-gray-700 border-gray-600 text-gray-400'}`}>
                        {user.is_verified ? '✅ Verified' : 'Mark Verified'}
                      </button>
                    </div>
                  </div>

                  {/* Password reset */}
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    {resetDone === user.id ? (
                      <p className="text-xs text-green-400 text-center">✅ Reset email sent!</p>
                    ) : (
                      <button
                        onClick={() => {/* need email — show placeholder */ alert('Password reset requires user email. Use Supabase Auth dashboard to get it.') }}
                        className="w-full text-xs text-blue-400 hover:text-blue-300 py-1"
                      >
                        🔑 Send Password Reset Email
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Routes Tab */}
      {tab === 'routes' && (
        <div className="space-y-3">
          <p className="text-gray-400 text-sm">Review and verify user-submitted safe routes.</p>
          {routes.length === 0 && <p className="text-gray-500 text-sm">No routes submitted yet.</p>}
          {routes.map(route => (
            <div key={route.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-white font-semibold">{route.name}</p>
                  <p className="text-gray-500 text-xs">{route.route_geojson?.coordinates?.length ?? 0} GPS points · {new Date(route.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`badge text-xs ${route.is_verified ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'}`}>
                  {route.is_verified ? 'Verified' : 'Pending'}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => verifyRoute(route.id, !route.is_verified)}
                  className={`flex-1 text-xs font-semibold py-2 rounded-lg border transition-colors ${route.is_verified
                    ? 'bg-gray-700 border-gray-600 text-gray-400'
                    : 'bg-green-700/30 border-green-600/40 text-green-400'}`}>
                  {route.is_verified ? 'Unverify' : '✓ Verify Route'}
                </button>
                <button onClick={() => deleteRoute(route.id)}
                  className="flex-1 text-xs font-semibold py-2 rounded-lg border bg-red-900/30 border-red-700/40 text-red-400 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* System Tab */}
      {tab === 'system' && (
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
            <h2 className="font-semibold text-white mb-3">Escalation Timers</h2>
            {[
              { level: 'Level 1', time: '~1s', desc: 'Notify trusted contacts immediately' },
              { level: 'Level 2', time: '60s', desc: 'Escalate to campus security' },
              { level: 'Level 3', time: '180s', desc: 'Full campus broadcast' },
            ].map(l => (
              <div key={l.level} className="flex items-center gap-3 py-2.5 border-b border-gray-700 last:border-0">
                <span className="badge bg-red-900/40 text-red-400 w-20 justify-center text-xs">{l.level}</span>
                <span className="text-white text-sm font-mono">{l.time}</span>
                <span className="text-gray-500 text-xs">{l.desc}</span>
              </div>
            ))}
          </div>

          <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
            <h2 className="font-semibold text-white mb-3">Platform Stats</h2>
            <PlatformStats />
          </div>
        </div>
      )}
    </div>
  )
}

function PlatformStats() {
  const [stats, setStats] = useState({ sos: 0, incidents: 0, users: 0, routes: 0 })

  useEffect(() => {
    Promise.all([
      supabase.from('sos_events').select('id', { count: 'exact', head: true }),
      supabase.from('incident_reports').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('safe_routes').select('id', { count: 'exact', head: true }),
    ]).then(([s, i, u, r]) => {
      setStats({ sos: s.count ?? 0, incidents: i.count ?? 0, users: u.count ?? 0, routes: r.count ?? 0 })
    })
  }, [])

  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: 'Total SOS Events', value: stats.sos, icon: '🚨' },
        { label: 'Total Incidents', value: stats.incidents, icon: '⚠️' },
        { label: 'Registered Users', value: stats.users, icon: '👤' },
        { label: 'Safe Routes', value: stats.routes, icon: '🛤' },
      ].map(s => (
        <div key={s.label} className="bg-gray-700/50 rounded-xl p-3 text-center">
          <p className="text-2xl mb-1">{s.icon}</p>
          <p className="text-2xl font-black text-white">{s.value}</p>
          <p className="text-gray-400 text-xs">{s.label}</p>
        </div>
      ))}
    </div>
  )
}
