import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getCurrentPosition, watchPosition } from '../lib/geolocation'
import type { BuddyAvailability } from '../types'

// Fix leaflet default marker icons in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const meIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})
const buddyIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})

type BuddyRequest = {
  id: string
  requester_id: string
  buddy_id: string
  status: 'pending' | 'accepted' | 'declined' | 'completed'
  req_lat: number | null
  req_lng: number | null
  buddy_lat: number | null
  buddy_lng: number | null
  created_at: string
  requester_name?: string
  buddy_name?: string
}

export default function Community() {
  const { user, profile } = useAuth()
  const [buddies, setBuddies] = useState<BuddyAvailability[]>([])
  const [myAvailability, setMyAvailability] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [incomingRequests, setIncomingRequests] = useState<BuddyRequest[]>([])
  const [activeSession, setActiveSession] = useState<BuddyRequest | null>(null)
  const [myPendingRequest, setMyPendingRequest] = useState<BuddyRequest | null>(null)
  const [requesting, setRequesting] = useState<string | null>(null)
  const stopWatchRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!user) return
    fetchBuddies()
    fetchMyAvailability()
    fetchMyRequests()

    const channel = supabase
      .channel('buddy:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buddy_availability' }, fetchBuddies)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buddy_requests', filter: `buddy_id=eq.${user.id}` }, fetchMyRequests)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buddy_requests', filter: `requester_id=eq.${user.id}` }, fetchMyRequests)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      stopWatchRef.current?.()
    }
  }, [user])

  async function fetchBuddies() {
    if (!user) return
    const { data } = await supabase
      .from('buddy_availability')
      .select('*')
      .eq('is_available', true)
      .neq('user_id', user.id)
      .order('last_seen', { ascending: false })

    if (!data) { setBuddies([]); return }

    const userIds = data.map((b) => b.user_id)
    if (userIds.length === 0) { setBuddies([]); return }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds)

    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))
    setBuddies(data.map((b) => ({ ...b, profile: profileMap[b.user_id] ?? undefined })))
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

  async function fetchMyRequests() {
    if (!user) return

    // Requests where I'm the buddy (incoming)
    const { data: incoming } = await supabase
      .from('buddy_requests')
      .select('*')
      .eq('buddy_id', user.id)
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false })

    // Requests where I'm the requester (outgoing)
    const { data: outgoing } = await supabase
      .from('buddy_requests')
      .select('*')
      .eq('requester_id', user.id)
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false })

    // Fetch names
    const allIds = [
      ...(incoming ?? []).map((r) => r.requester_id),
      ...(outgoing ?? []).map((r) => r.buddy_id),
    ]
    const { data: profiles } = allIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', allIds)
      : { data: [] }
    const nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name ?? 'Unknown']))

    const enriched = (reqs: BuddyRequest[], field: 'requester_id' | 'buddy_id') =>
      (reqs ?? []).map((r) => ({ ...r, [`${field === 'requester_id' ? 'requester' : 'buddy'}_name`]: nameMap[r[field]] }))

    setIncomingRequests(enriched(incoming as BuddyRequest[], 'requester_id'))

    const myOut = (outgoing ?? [])[0] as BuddyRequest | undefined
    const myPending = myOut ? { ...myOut, buddy_name: nameMap[myOut.buddy_id] } : null
    setMyPendingRequest(myPending)

    // Active accepted session
    const acceptedIncoming = (incoming ?? []).find((r) => r.status === 'accepted') as BuddyRequest | undefined
    const acceptedOutgoing = (outgoing ?? []).find((r) => r.status === 'accepted') as BuddyRequest | undefined
    const session = acceptedIncoming ?? acceptedOutgoing ?? null
    const enrichedSession = session
      ? { ...session, requester_name: nameMap[session.requester_id], buddy_name: nameMap[session.buddy_id] }
      : null
    setActiveSession(enrichedSession as BuddyRequest | null)

    // Start live location sharing if in active session
    if (enrichedSession) startLocationSharing(enrichedSession as BuddyRequest)
    else stopWatchRef.current?.()
  }

  function startLocationSharing(session: BuddyRequest) {
    stopWatchRef.current?.()
    const isBuddy = session.buddy_id === user?.id
    const field = isBuddy ? 'buddy_lat' : 'req_lat'
    const lngField = isBuddy ? 'buddy_lng' : 'req_lng'

    stopWatchRef.current = watchPosition(async (lat, lng) => {
      await supabase
        .from('buddy_requests')
        .update({ [field]: lat, [lngField]: lng })
        .eq('id', session.id)
    }, 5000)
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

  async function requestEscort(buddy: BuddyAvailability) {
    if (!user) return
    setRequesting(buddy.user_id)
    const coords = await getCurrentPosition().catch(() => null)

    const { data: req } = await supabase
      .from('buddy_requests')
      .insert({
        requester_id: user.id,
        buddy_id: buddy.user_id,
        status: 'pending',
        req_lat: coords?.latitude ?? null,
        req_lng: coords?.longitude ?? null,
      })
      .select()
      .single()

    // Notify the buddy
    await supabase.from('notifications').insert({
      user_id: buddy.user_id,
      type: 'info',
      title: `👥 Escort Request from ${profile?.full_name ?? 'Someone'}`,
      body: `${profile?.full_name ?? 'A student'} needs an escort. Open Campus Buddy to respond.`,
    })

    if (req) setMyPendingRequest({ ...req, buddy_name: buddy.profile?.full_name })
    setRequesting(null)
  }

  async function respondToRequest(reqId: string, accept: boolean) {
    const newStatus = accept ? 'accepted' : 'declined'
    await supabase.from('buddy_requests').update({ status: newStatus }).eq('id', reqId)

    // Notify requester
    const req = incomingRequests.find((r) => r.id === reqId)
    if (req) {
      await supabase.from('notifications').insert({
        user_id: req.requester_id,
        type: 'info',
        title: accept ? '✅ Buddy is on the way!' : '❌ Buddy unavailable',
        body: accept
          ? `${profile?.full_name ?? 'Your buddy'} accepted and is heading to you.`
          : `${profile?.full_name ?? 'Your buddy'} is currently unavailable. Try another buddy.`,
      })
    }

    fetchMyRequests()
  }

  async function endSession() {
    if (!activeSession) return
    await supabase.from('buddy_requests').update({ status: 'completed' }).eq('id', activeSession.id)
    stopWatchRef.current?.()
    setActiveSession(null)
    setMyPendingRequest(null)
    fetchMyRequests()
  }

  async function cancelRequest() {
    if (!myPendingRequest) return
    await supabase.from('buddy_requests').update({ status: 'declined' }).eq('id', myPendingRequest.id)
    setMyPendingRequest(null)
  }

  // ── Active escort session ───────────────────────────────────────
  if (activeSession) {
    const isBuddy = activeSession.buddy_id === user?.id
    const myLat = isBuddy ? activeSession.buddy_lat : activeSession.req_lat
    const myLng = isBuddy ? activeSession.buddy_lng : activeSession.req_lng
    const otherLat = isBuddy ? activeSession.req_lat : activeSession.buddy_lat
    const otherLng = isBuddy ? activeSession.req_lng : activeSession.buddy_lng
    const otherName = isBuddy ? activeSession.requester_name : activeSession.buddy_name
    const center = (myLat && myLng) ? [myLat, myLng] as [number, number] : [13.0827, 80.2707] as [number, number]

    return (
      <div className="py-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Live Escort Session</h1>
            <p className="text-sm text-gray-500">
              {isBuddy ? `Escorting ${activeSession.requester_name}` : `${activeSession.buddy_name} is your buddy`}
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-xs bg-green-100 text-green-700 font-semibold px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            LIVE
          </span>
        </div>

        <div className="rounded-2xl overflow-hidden shadow h-72">
          <MapContainer center={center} zoom={16} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {myLat && myLng && (
              <Marker position={[myLat, myLng]} icon={meIcon}>
                <Popup>You</Popup>
              </Marker>
            )}
            {otherLat && otherLng && (
              <Marker position={[otherLat, otherLng]} icon={buddyIcon}>
                <Popup>{otherName ?? 'Other person'}</Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-lg">👤</div>
            <div>
              <p className="font-semibold text-sm text-gray-800">{otherName ?? 'Your buddy'}</p>
              <p className="text-xs text-gray-400">
                {otherLat ? `${otherLat.toFixed(5)}, ${otherLng?.toFixed(5)}` : 'Waiting for location...'}
              </p>
            </div>
            <span className="ml-auto w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
          </div>
          <button onClick={endSession} className="w-full py-2.5 rounded-xl bg-red-100 text-red-600 font-semibold text-sm">
            {isBuddy ? 'End Escort' : 'I\'m Safe — End Session'}
          </button>
        </div>
      </div>
    )
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
          <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${myAvailability ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Incoming requests (if I'm a buddy) */}
      {incomingRequests.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-orange-400 rounded-full animate-ping" />
            Escort Requests
          </h2>
          {incomingRequests.map((req) => (
            <IncomingRequestCard
              key={req.id}
              request={req}
              onAccept={() => respondToRequest(req.id, true)}
              onDecline={() => respondToRequest(req.id, false)}
            />
          ))}
        </div>
      )}

      {/* My pending outgoing request */}
      {myPendingRequest && !activeSession && (
        <div className="card border-l-4 border-primary-500">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm text-gray-800">Waiting for {myPendingRequest.buddy_name ?? 'buddy'}...</p>
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-semibold">Pending</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">Your location is shared. They'll accept shortly.</p>
          <button onClick={cancelRequest} className="text-xs text-red-500 font-semibold">Cancel Request</button>
        </div>
      )}

      {/* Available buddies */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Available Buddies</h2>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">{buddies.length} online</span>
        </div>

        {buddies.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-3xl mb-2">👥</p>
            <p className="text-gray-500 text-sm">No buddies available right now.</p>
            <p className="text-gray-400 text-xs mt-1">Toggle your availability above to help others.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {buddies.map((buddy) => (
              <BuddyCard
                key={buddy.user_id}
                buddy={buddy}
                requesting={requesting === buddy.user_id}
                hasActivePending={!!myPendingRequest}
                onRequest={() => requestEscort(buddy)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function IncomingRequestCard({
  request,
  onAccept,
  onDecline,
}: {
  request: BuddyRequest
  onAccept: () => void
  onDecline: () => void
}) {
  const center = (request.req_lat && request.req_lng)
    ? [request.req_lat, request.req_lng] as [number, number]
    : null

  return (
    <div className="card border-l-4 border-orange-400">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-lg flex-shrink-0">👤</div>
        <div className="flex-1">
          <p className="font-semibold text-sm text-gray-800">{request.requester_name ?? 'Campus Student'}</p>
          <p className="text-xs text-gray-500">Needs an escort</p>
          {request.req_lat && (
            <p className="text-xs text-gray-400">{request.req_lat.toFixed(4)}, {request.req_lng?.toFixed(4)}</p>
          )}
        </div>
        <span className="w-2.5 h-2.5 bg-orange-400 rounded-full animate-pulse flex-shrink-0" />
      </div>

      {center && (
        <div className="rounded-xl overflow-hidden mb-3 h-40">
          <MapContainer center={center} zoom={16} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={center}>
              <Popup>{request.requester_name ?? 'Requester'}</Popup>
            </Marker>
          </MapContainer>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onAccept} className="flex-1 py-2 rounded-xl bg-green-500 text-white font-semibold text-sm">
          ✓ Accept
        </button>
        <button onClick={onDecline} className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 font-semibold text-sm">
          Decline
        </button>
      </div>
    </div>
  )
}

function BuddyCard({
  buddy,
  requesting,
  hasActivePending,
  onRequest,
}: {
  buddy: BuddyAvailability
  requesting: boolean
  hasActivePending: boolean
  onRequest: () => void
}) {
  const lastSeen = new Date(buddy.last_seen)
  const minutesAgo = Math.floor((Date.now() - lastSeen.getTime()) / 60000)

  return (
    <div className="card flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-lg flex-shrink-0">
        {buddy.profile?.avatar_url ? (
          <img src={buddy.profile.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
        ) : '👤'}
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
        <button
          onClick={onRequest}
          disabled={requesting || hasActivePending}
          className="text-xs bg-primary-100 text-primary-700 font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40"
        >
          {requesting ? '...' : 'Request Escort'}
        </button>
      </div>
    </div>
  )
}
