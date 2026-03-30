import { useEffect, useState, FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useNotifications } from '../hooks/useNotifications'
import type { TrustedContact } from '../types'

export default function Profile() {
  const { profile, signOut, refreshProfile } = useAuth()
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const [contacts, setContacts] = useState<TrustedContact[]>([])
  const [tab, setTab] = useState<'contacts' | 'notifications' | 'profile'>('contacts')
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '' })
  const [saving, setSaving] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    supabase
      .from('trusted_contacts')
      .select('*')
      .eq('user_id', user.id)
      .order('priority')
      .then(({ data }) => setContacts(data ?? []))
  }, [user])

  async function addContact(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    const { data } = await supabase
      .from('trusted_contacts')
      .insert({
        user_id: user.id,
        name: newContact.name,
        phone: newContact.phone || null,
        email: newContact.email || null,
        priority: contacts.length + 1,
        notify_via: ['push', 'sms'],
      })
      .select()
      .single()
    if (data) setContacts((prev) => [...prev, data])
    setNewContact({ name: '', phone: '', email: '' })
    setSaving(false)
  }

  async function removeContact(id: string) {
    await supabase.from('trusted_contacts').delete().eq('id', id)
    setContacts((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="py-4 flex flex-col gap-4">
      {/* Profile header */}
      <div className="card flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-2xl">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} className="w-14 h-14 rounded-full object-cover" alt="" />
          ) : '👤'}
        </div>
        <div className="flex-1">
          <p className="font-bold text-gray-800">{profile?.full_name ?? 'User'}</p>
          <span className={`badge ${profile?.role === 'admin' || profile?.role === 'security' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'} capitalize`}>
            {profile?.role ?? 'student'}
          </span>
        </div>
        <button onClick={signOut} className="text-sm text-red-500 font-medium">
          Sign Out
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['contacts', 'notifications', 'profile'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); if (t === 'notifications') markAllRead() }}
            className={`flex-1 py-2 text-sm font-medium capitalize transition-colors relative ${
              tab === t ? 'text-primary-600' : 'text-gray-500'
            }`}
          >
            {t}
            {t === 'notifications' && unreadCount > 0 && (
              <span className="absolute top-1 right-1/4 -translate-x-1/2 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">
                {unreadCount}
              </span>
            )}
            {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" />}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'contacts' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Up to 5 contacts notified during SOS, in priority order.</p>

          {contacts.map((c, i) => (
            <div key={c.id} className="card flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-800">{c.name}</p>
                <p className="text-xs text-gray-400">{c.phone ?? c.email ?? 'No contact info'}</p>
              </div>
              <button onClick={() => removeContact(c.id)} className="text-red-400 hover:text-red-600 text-sm">
                ✕
              </button>
            </div>
          ))}

          {contacts.length < 5 && (
            <form onSubmit={addContact} className="card space-y-3 border-dashed border-2 border-primary-200">
              <p className="font-semibold text-sm text-primary-700">+ Add Trusted Contact</p>
              <input
                type="text"
                className="input"
                value={newContact.name}
                onChange={(e) => setNewContact((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="Full name"
              />
              <input
                type="tel"
                className="input"
                value={newContact.phone}
                onChange={(e) => setNewContact((f) => ({ ...f, phone: e.target.value }))}
                placeholder="Phone number"
              />
              <input
                type="email"
                className="input"
                value={newContact.email}
                onChange={(e) => setNewContact((f) => ({ ...f, email: e.target.value }))}
                placeholder="Email (optional)"
              />
              <button type="submit" disabled={saving} className="btn-primary w-full text-sm">
                {saving ? 'Adding...' : 'Add Contact'}
              </button>
            </form>
          )}
        </div>
      )}

      {tab === 'notifications' && (
        <div className="space-y-2">
          {notifications.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-3xl mb-2">🔔</p>
              <p className="text-gray-500 text-sm">No notifications yet.</p>
            </div>
          )}
          {notifications.map((n) => (
            <div key={n.id} className={`card flex gap-3 ${!n.is_read ? 'border-l-4 border-primary-500' : ''}`}>
              <span className="text-xl mt-0.5">
                {n.type === 'sos_alert' ? '🚨' : n.type === 'resolved' ? '✅' : n.type === 'checkin' ? '⏰' : 'ℹ️'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-800">{n.title}</p>
                {n.body && <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>}
                <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'profile' && (
        <div className="card space-y-3">
          <InfoRow label="Name" value={profile?.full_name ?? '—'} />
          <InfoRow label="Role" value={profile?.role ?? '—'} />
          <InfoRow label="Campus ID" value={profile?.campus_id ?? '—'} />
          <InfoRow label="Hostel Block" value={profile?.hostel_block ?? '—'} />
          <InfoRow label="Verified" value={profile?.is_verified ? '✅ Yes' : '❌ No'} />
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800 capitalize">{value}</span>
    </div>
  )
}
