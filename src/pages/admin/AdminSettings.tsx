import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../types'

export default function AdminSettings() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setUsers(data ?? [])
        setLoading(false)
      })
  }, [])

  async function updateRole(userId: string, role: string) {
    await supabase.from('profiles').update({ role }).eq('id', userId)
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: role as any } : u)))
  }

  const filtered = users.filter((u) =>
    (u.full_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-2">Admin Settings</h1>
      <p className="text-gray-400 text-sm mb-6">Manage user roles and campus configuration</p>

      {/* Escalation timer info */}
      <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 mb-6">
        <h2 className="font-semibold text-white mb-3">Escalation Timers (configured in Edge Function)</h2>
        <div className="space-y-2">
          {[
            { level: 'Level 1', time: '0s', description: 'Notify trusted contacts immediately' },
            { level: 'Level 2', time: '60s', description: 'Escalate to campus security' },
            { level: 'Level 3', time: '180s', description: 'Full campus broadcast' },
          ].map((l) => (
            <div key={l.level} className="flex items-center gap-3 py-2 border-b border-gray-700 last:border-0">
              <span className="badge bg-red-900/40 text-red-400 w-20 justify-center">{l.level}</span>
              <span className="text-gray-300 text-sm font-mono">{l.time}</span>
              <span className="text-gray-500 text-xs">{l.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* User management */}
      <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">User Management</h2>
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder-gray-500"
          />
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading users...</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((user) => (
              <div key={user.id} className="flex items-center gap-3 py-2 border-b border-gray-700 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{user.full_name ?? 'Unnamed'}</p>
                  <p className="text-gray-500 text-xs">{user.campus_id ?? 'No campus ID'}</p>
                </div>
                <select
                  value={user.role}
                  onChange={(e) => updateRole(user.id, e.target.value)}
                  className="bg-gray-700 border border-gray-600 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                >
                  <option value="student">Student</option>
                  <option value="faculty">Faculty</option>
                  <option value="security">Security</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
