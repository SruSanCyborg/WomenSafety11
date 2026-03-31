import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getCurrentPosition } from '../lib/geolocation'
import type { BuddyAvailability } from '../types'

export default function Community() {
  const { user } = useAuth()
  const [buddies, setBuddies] = useState<BuddyAvailability[]>([])
  const [myAvailability, setMyAvailability] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [requesting, setRequesting] = useState<string | null>(null)
  const [requestedBuddies, setRequestedBuddies] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchBuddies()
    fetchMyAvailability()

    const channel = supabase
      .channel('buddy:availability')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buddy_availability' }, fetchBuddies)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  async function fetchBuddies() {
    const { data } = await supabase
      .from('buddy_availability')
      .select('*')
      .eq('is_available', true)
      .order('last_seen', { ascending: false })

    if (!data) { setBuddies([]); return }

    // Fetch profiles separately to avoid FK join issues
    const userIds = data.map((b) => b.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds)

    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))
    setBuddies(data.map((b) => ({ ...b, profile: profileMap[b.user_id] ?? undefined })))
  }

  async function requestEscort(buddyUserId: string, buddyName: string) {
    if (!user) return
    setRequesting(buddyUserId)
    await supabase.from('notifications').insert({
      user_id: buddyUserId,
      type: 'info',
      title: '👥 Buddy Escort Request',
      body: `Someone on campus needs an escort. Open the app to respond.`,
    })
    setRequestedBuddies((prev) => new Set(prev).add(buddyUserId))
    setRequesting(null)
  }

  async function fetchMyAvailability() {
    if (!user) return
    const { data } = await supabase
      .from('buddy_availability')
      .select('is_available')
      .eq('user_id', user.id)
      .maybeSingle()
    setMyAvailability(data?.is_available ?? false)
  }

  async function toggleAvailability() {
    if (!user) return
    setToggling(true)
    const coords = await getCurrentPosition().catch(() => null)
    const next = !myAvailability

    await supabase.from('buddy_availability').upsert({
      user_id: user.id,
      is_available: next,
      lat: next ? coords?.latitude ?? null : null,
      lng: next ? coords?.longitude ?? null : null,
      last_seen: new Date().toISOString(),
    })

    setMyAvailability(next)
    setToggling(false)
    fetchBuddies()
  }

  return (
    <div className="py-4 flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Campus Buddy Network</h1>
        <p className="text-sm text-gray-500">Peer volunteers available to escort or respond</p>
      </div>

      {/* My availability toggle */}
      <div className="card flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-800">I'm Available as Buddy</p>
          <p className="text-xs text-gray-500">
            {myAvailability ? 'You are visible to others who need help' : 'Toggle on to offer peer support'}
          </p>
        </div>
        <button
          onClick={toggleAvailability}
          disabled={toggling}
          className={`w-14 h-7 rounded-full transition-colors relative ${myAvailability ? 'bg-green-500' : 'bg-gray-300'} disabled:opacity-50`}
        >
          <span
            className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${myAvailability ? 'translate-x-7' : 'translate-x-1'}`}
          />
        </button>
      </div>

      {/* Available buddies */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Available Buddies</h2>
          <span className="badge bg-green-100 text-green-700">{buddies.length} online</span>
        </div>

        {buddies.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-3xl mb-2">👥</p>
            <p className="text-gray-500 text-sm">No buddies available right now.</p>
            <p className="text-gray-400 text-xs mt-1">Toggle your availability above to help others.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {buddies.filter(b => b.user_id !== user?.id).map((buddy) => (
              <BuddyCard
                key={buddy.user_id}
                buddy={buddy}
                requested={requestedBuddies.has(buddy.user_id)}
                requesting={requesting === buddy.user_id}
                onRequest={() => requestEscort(buddy.user_id, buddy.profile?.full_name ?? 'Buddy')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BuddyCard({
  buddy,
  requested,
  requesting,
  onRequest,
}: {
  buddy: BuddyAvailability
  requested: boolean
  requesting: boolean
  onRequest: () => void
}) {
  const lastSeen = new Date(buddy.last_seen)
  const minutesAgo = Math.floor((Date.now() - lastSeen.getTime()) / 60000)

  return (
    <div className="card flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-lg flex-shrink-0">
        {buddy.profile?.avatar_url ? (
          <img src={buddy.profile.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
        ) : (
          '👤'
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-800 truncate">
          {buddy.profile?.full_name ?? 'Campus Buddy'}
        </p>
        <p className="text-xs text-gray-400">
          Active {minutesAgo < 1 ? 'just now' : `${minutesAgo}m ago`}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
        {requested ? (
          <span className="text-xs text-green-600 font-semibold">Requested ✓</span>
        ) : (
          <button
            onClick={onRequest}
            disabled={requesting}
            className="text-xs bg-primary-100 text-primary-700 font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {requesting ? '...' : 'Request'}
          </button>
        )}
      </div>
    </div>
  )
}
