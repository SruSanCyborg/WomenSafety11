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
  status: 'pending' | 'screening' | 'accepted' | 'declined' | 'completed'
  req_lat: number | null
  req_lng: number | null
  buddy_lat: number | null
  buddy_lng: number | null
  requester_consented: boolean
  buddy_consented: boolean
  created_at: string
  requester_name?: string
  buddy_name?: string
}

type DirectMessage = {
  id: string
  request_id: string
  sender_id: string
  content: string
  created_at: string
}

export type AIMessage = { role: 'user' | 'model'; content: string }

// ── Helpers ────────────────────────────────────────────────────────────────

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function callGemini(messages: AIMessage[], systemPrompt: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) return '⚠️ AI screening unavailable — VITE_GROQ_API_KEY not set.'
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          ...(messages.length > 0
            ? messages.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content }))
            : [{ role: 'user', content: 'Hello' }]
          ),
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    })
    const data = await res.json()
    if (data.error) {
      console.error('Groq error:', data.error)
      return `AI error: ${data.error.message}`
    }
    return data.choices?.[0]?.message?.content ?? "I'm having trouble responding right now."
  } catch (e) {
    console.error('Groq fetch error:', e)
    return 'Connection error. Please try again.'
  }
}

// ── Main component ─────────────────────────────────────────────────────────

export default function Community() {
  const { user, profile } = useAuth()
  const [buddies, setBuddies] = useState<BuddyAvailability[]>([])
  const [myAvailability, setMyAvailability] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [incomingRequests, setIncomingRequests] = useState<BuddyRequest[]>([])
  const [activeSession, setActiveSession] = useState<BuddyRequest | null>(null)
  const [myPendingRequest, setMyPendingRequest] = useState<BuddyRequest | null>(null)
  const [requesting, setRequesting] = useState<string | null>(null)
  const [aiScreeningRequest, setAiScreeningRequest] = useState<BuddyRequest | null>(null)
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const stopWatchRef = useRef<(() => void) | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

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

  // Subscribe to direct messages when session is active
  useEffect(() => {
    if (!activeSession) { setDirectMessages([]); return }
    fetchDirectMessages(activeSession.id)

    const ch = supabase
      .channel(`dm:${activeSession.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'buddy_direct_messages',
        filter: `request_id=eq.${activeSession.id}`,
      }, (payload) => {
        setDirectMessages(prev => [...prev, payload.new as DirectMessage])
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [activeSession?.id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [directMessages])

  async function fetchDirectMessages(requestId: string) {
    const { data } = await supabase
      .from('buddy_direct_messages')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })
    setDirectMessages((data ?? []) as DirectMessage[])
  }

  async function fetchBuddies() {
    if (!user) return
    const { data } = await supabase
      .from('buddy_availability')
      .select('*')
      .eq('is_available', true)
      .neq('user_id', user.id)
      .order('last_seen', { ascending: false })

    if (!data) { setBuddies([]); return }
    const userIds = data.map(b => b.user_id)
    if (userIds.length === 0) { setBuddies([]); return }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds)

    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
    setBuddies(data.map(b => ({ ...b, profile: profileMap[b.user_id] ?? undefined })))
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

    const { data: incoming } = await supabase
      .from('buddy_requests')
      .select('*')
      .eq('buddy_id', user.id)
      .in('status', ['pending', 'screening', 'accepted'])
      .order('created_at', { ascending: false })

    const { data: outgoing } = await supabase
      .from('buddy_requests')
      .select('*')
      .eq('requester_id', user.id)
      .in('status', ['pending', 'screening', 'accepted'])
      .order('created_at', { ascending: false })

    const allIds = [
      ...(incoming ?? []).map(r => r.requester_id),
      ...(outgoing ?? []).map(r => r.buddy_id),
    ]
    const { data: profiles } = allIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', allIds)
      : { data: [] }
    const nameMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.full_name ?? 'Unknown']))

    const enrichedIncoming = (incoming ?? []).map(r => ({
      ...r,
      requester_name: nameMap[r.requester_id],
      buddy_name: nameMap[r.buddy_id],
    })) as BuddyRequest[]

    const enrichedOutgoing = (outgoing ?? []).map(r => ({
      ...r,
      requester_name: nameMap[r.requester_id],
      buddy_name: nameMap[r.buddy_id],
    })) as BuddyRequest[]

    setIncomingRequests(enrichedIncoming.filter(r => r.status !== 'accepted'))

    const myOut = enrichedOutgoing[0] ?? null
    setMyPendingRequest(myOut?.status !== 'accepted' ? myOut : null)

    const acceptedIncoming = enrichedIncoming.find(r => r.status === 'accepted')
    const acceptedOutgoing = enrichedOutgoing.find(r => r.status === 'accepted')
    const session = acceptedIncoming ?? acceptedOutgoing ?? null
    setActiveSession(session)

    if (session) startLocationSharing(session)
    else stopWatchRef.current?.()

    // Auto-transition: both consented in screening → accepted (location check)
    const screeningReqs = [
      ...enrichedIncoming.filter(r => r.status === 'screening'),
      ...enrichedOutgoing.filter(r => r.status === 'screening'),
    ]
    for (const req of screeningReqs) {
      if (!req.requester_consented || !req.buddy_consented) continue
      const { req_lat, req_lng, buddy_lat, buddy_lng } = req
      const locationOk = req_lat && req_lng && buddy_lat && buddy_lng
        ? haversineDistance(req_lat, req_lng, buddy_lat, buddy_lng) < 5000
        : true
      if (locationOk) {
        await supabase.from('buddy_requests').update({ status: 'accepted' }).eq('id', req.id)
        fetchMyRequests()
        break
      }
    }
  }

  function startLocationSharing(session: BuddyRequest) {
    stopWatchRef.current?.()
    const isBuddy = session.buddy_id === user?.id
    const latField = isBuddy ? 'buddy_lat' : 'req_lat'
    const lngField = isBuddy ? 'buddy_lng' : 'req_lng'

    stopWatchRef.current = watchPosition(async (lat, lng) => {
      await supabase
        .from('buddy_requests')
        .update({ [latField]: lat, [lngField]: lng })
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
        requester_consented: false,
        buddy_consented: false,
      })
      .select()
      .single()

    await supabase.from('notifications').insert({
      user_id: buddy.user_id,
      type: 'info',
      title: `👥 Escort Request from ${profile?.full_name ?? 'Someone'}`,
      body: `${profile?.full_name ?? 'A student'} needs an escort. Open Campus Buddy to respond.`,
    })

    if (req) setMyPendingRequest({ ...req, buddy_name: buddy.profile?.full_name })
    setRequesting(null)
  }

  async function startScreening(req: BuddyRequest) {
    const isBuddy = req.buddy_id === user?.id
    const coords = await getCurrentPosition().catch(() => null)
    const update: Record<string, unknown> = { status: 'screening' }
    if (isBuddy && coords) {
      update.buddy_lat = coords.latitude
      update.buddy_lng = coords.longitude
    }
    await supabase.from('buddy_requests').update(update).eq('id', req.id)
    setAiScreeningRequest({ ...req, status: 'screening', ...update } as BuddyRequest)
  }

  async function onAIConsentGranted(req: BuddyRequest) {
    const isBuddy = req.buddy_id === user?.id
    await supabase
      .from('buddy_requests')
      .update({ [isBuddy ? 'buddy_consented' : 'requester_consented']: true })
      .eq('id', req.id)
    setAiScreeningRequest(null)
    fetchMyRequests()
  }

  async function declineRequest(reqId: string) {
    await supabase.from('buddy_requests').update({ status: 'declined' }).eq('id', reqId)
    const req = incomingRequests.find(r => r.id === reqId)
    if (req) {
      await supabase.from('notifications').insert({
        user_id: req.requester_id,
        type: 'info',
        title: '❌ Buddy unavailable',
        body: `${profile?.full_name ?? 'Your buddy'} is currently unavailable.`,
      })
    }
    fetchMyRequests()
  }

  async function sendDirectMessage() {
    if (!activeSession || !chatInput.trim() || !user) return
    setSendingMsg(true)
    const content = chatInput.trim()
    setChatInput('')
    await supabase.from('buddy_direct_messages').insert({
      request_id: activeSession.id,
      sender_id: user.id,
      content,
    })
    setSendingMsg(false)
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

  // ── AI Screening modal (full screen takeover) ──────────────────────────
  if (aiScreeningRequest) {
    return (
      <AIScreeningModal
        request={aiScreeningRequest}
        isRequester={aiScreeningRequest.requester_id === user?.id}
        myName={profile?.full_name ?? 'You'}
        onConsentGranted={() => onAIConsentGranted(aiScreeningRequest)}
        onClose={() => setAiScreeningRequest(null)}
      />
    )
  }

  // ── Active escort session with direct chat ─────────────────────────────
  if (activeSession) {
    const isBuddy = activeSession.buddy_id === user?.id
    const myLat = isBuddy ? activeSession.buddy_lat : activeSession.req_lat
    const myLng = isBuddy ? activeSession.buddy_lng : activeSession.req_lng
    const otherLat = isBuddy ? activeSession.req_lat : activeSession.buddy_lat
    const otherLng = isBuddy ? activeSession.req_lng : activeSession.buddy_lng
    const otherName = isBuddy ? activeSession.requester_name : activeSession.buddy_name
    const center: [number, number] = (myLat && myLng) ? [myLat, myLng] : [13.0827, 80.2707]

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

        {/* Map */}
        <div className="rounded-2xl overflow-hidden shadow h-48">
          <MapContainer center={center} zoom={16} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {myLat && myLng && (
              <Marker position={[myLat, myLng]} icon={meIcon}><Popup>You</Popup></Marker>
            )}
            {otherLat && otherLng && (
              <Marker position={[otherLat, otherLng]} icon={buddyIcon}><Popup>{otherName ?? 'Buddy'}</Popup></Marker>
            )}
          </MapContainer>
        </div>

        {/* Direct chat */}
        <div className="card flex flex-col gap-3">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <span className="text-lg">💬</span>
            <p className="font-semibold text-sm text-gray-800">Chat with {otherName ?? 'Buddy'}</p>
            <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-medium">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Connected
            </span>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 h-52 overflow-y-auto flex flex-col gap-2">
            {directMessages.length === 0 && (
              <p className="text-xs text-gray-400 text-center m-auto">
                Details shared securely. Say hi 👋
              </p>
            )}
            {directMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-snug ${
                    msg.sender_id === user?.id
                      ? 'bg-primary-500 text-white rounded-br-sm'
                      : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendDirectMessage()}
              placeholder="Type a message..."
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <button
              onClick={sendDirectMessage}
              disabled={sendingMsg || !chatInput.trim()}
              className="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
            >
              Send
            </button>
          </div>

          <button onClick={endSession} className="w-full py-2.5 rounded-xl bg-red-100 text-red-600 font-semibold text-sm">
            {isBuddy ? 'End Escort' : "I'm Safe — End Session"}
          </button>
        </div>
      </div>
    )
  }

  // ── Main community view ────────────────────────────────────────────────
  return (
    <div className="py-4 flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Campus Buddy Network</h1>
        <p className="text-sm text-gray-500">Peer volunteers available to escort or respond</p>
      </div>

      {/* Availability toggle */}
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

      {/* Incoming escort requests */}
      {incomingRequests.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-orange-400 rounded-full animate-ping" />
            Escort Requests
          </h2>
          {incomingRequests.map(req => (
            <IncomingRequestCard
              key={req.id}
              request={req}
              onStartScreening={() => startScreening(req)}
              onDecline={() => declineRequest(req.id)}
            />
          ))}
        </div>
      )}

      {/* My outgoing pending request */}
      {myPendingRequest && (
        <div className="card border-l-4 border-primary-500">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm text-gray-800">
              {myPendingRequest.status === 'screening'
                ? 'AI screening in progress...'
                : `Waiting for ${myPendingRequest.buddy_name ?? 'buddy'}...`}
            </p>
            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
              myPendingRequest.status === 'screening' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {myPendingRequest.status === 'screening' ? 'Screening' : 'Pending'}
            </span>
          </div>

          {/* Buddy consented, my turn */}
          {myPendingRequest.status === 'screening' && myPendingRequest.buddy_consented && !myPendingRequest.requester_consented && (
            <div className="mb-3 p-3 bg-blue-50 rounded-xl">
              <p className="text-xs text-blue-700 font-semibold mb-1">Your buddy is ready to connect!</p>
              <p className="text-xs text-blue-600 mb-2">Complete a quick AI safety check to proceed.</p>
              <button
                onClick={() => setAiScreeningRequest(myPendingRequest)}
                className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg font-semibold"
              >
                Start My Screening
              </button>
            </div>
          )}

          {myPendingRequest.requester_consented && !myPendingRequest.buddy_consented && (
            <p className="text-xs text-green-600 font-semibold mb-2">✓ Your screening done. Waiting for buddy...</p>
          )}

          {myPendingRequest.status === 'screening' && !myPendingRequest.buddy_consented && !myPendingRequest.requester_consented && (
            <button
              onClick={() => setAiScreeningRequest(myPendingRequest)}
              className="mb-3 text-xs bg-primary-100 text-primary-700 px-3 py-1.5 rounded-lg font-semibold"
            >
              Start AI Screening Now
            </button>
          )}

          <p className="text-xs text-gray-400 mb-3">Your details are shared only after mutual AI screening.</p>
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
            {buddies.map(buddy => (
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

// ── IncomingRequestCard ────────────────────────────────────────────────────

function IncomingRequestCard({
  request,
  onStartScreening,
  onDecline,
}: {
  request: BuddyRequest
  onStartScreening: () => void
  onDecline: () => void
}) {
  const center = request.req_lat && request.req_lng
    ? [request.req_lat, request.req_lng] as [number, number]
    : null

  const buddyDoneScreening = request.status === 'screening' && request.buddy_consented

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
            <Marker position={center}><Popup>{request.requester_name ?? 'Requester'}</Popup></Marker>
          </MapContainer>
        </div>
      )}

      {buddyDoneScreening ? (
        <div className="text-center py-2">
          <p className="text-xs text-green-600 font-semibold">✓ Your screening complete. Waiting for requester to finish...</p>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={onStartScreening}
            className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white font-semibold text-sm flex items-center justify-center gap-1.5"
          >
            <span>🤖</span>
            {request.status === 'screening' ? 'Continue Screening' : 'Screen & Help'}
          </button>
          <button onClick={onDecline} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-semibold text-sm">
            Decline
          </button>
        </div>
      )}
    </div>
  )
}

// ── BuddyCard ──────────────────────────────────────────────────────────────

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
  const minutesAgo = Math.floor((Date.now() - new Date(buddy.last_seen).getTime()) / 60000)

  return (
    <div className="card flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-lg flex-shrink-0">
        {buddy.profile?.avatar_url
          ? <img src={buddy.profile.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
          : '👤'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-800 truncate">{buddy.profile?.full_name ?? 'Campus Buddy'}</p>
        <p className="text-xs text-gray-400">Active {minutesAgo < 1 ? 'just now' : `${minutesAgo}m ago`}</p>
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

// ── AIScreeningModal ───────────────────────────────────────────────────────

function AIScreeningModal({
  request,
  isRequester,
  myName,
  onConsentGranted,
  onClose,
}: {
  request: BuddyRequest
  isRequester: boolean
  myName: string
  onConsentGranted: () => void
  onClose: () => void
}) {
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [consentGranted, setConsentGranted] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const dist = request.req_lat && request.req_lng && request.buddy_lat && request.buddy_lng
    ? Math.round(haversineDistance(request.req_lat, request.req_lng, request.buddy_lat, request.buddy_lng))
    : null
  const distText = dist ? `${dist < 1000 ? `${dist}m` : `${(dist / 1000).toFixed(1)}km`} away` : 'nearby'

  const systemPrompt = isRequester
    ? `You are SafeHer AI, a warm safety assistant for a campus escort service.
The user is ${myName}. They just requested a campus escort buddy who is ${distText}.
Steps:
1. Greet briefly and ask where they are and where they need to go.
2. Ask if they feel safe right now.
3. After they respond, confirm they want to connect with their buddy.
Rules: Keep every reply to 1-3 sentences. Be calm and warm. Never reveal the buddy's identity yet.
When the user clearly says they're ready to connect or wants to proceed, include [CONSENT_GRANTED] at the very end of your response.`
    : `You are SafeHer AI, a warm safety assistant for a campus escort service.
The user is ${myName}. A fellow student ${distText} needs an escort.
Steps:
1. Briefly explain — someone nearby needs an escort and you're ${distText} from them.
2. Ask if they're comfortable and available right now.
3. After they say yes, confirm they're ready to connect.
Rules: Keep every reply to 1-3 sentences. Be warm and professional. Never reveal the requester's identity yet.
When the user clearly confirms they'll help, include [CONSENT_GRANTED] at the very end of your response.`

  // AI sends the opening message on mount
  useEffect(() => {
    let alive = true
    setLoading(true)
    callGemini([], systemPrompt).then(response => {
      if (!alive) return
      const text = response.replace('[CONSENT_GRANTED]', '').trim()
      setMessages([{ role: 'model', content: text }])
      if (response.includes('[CONSENT_GRANTED]')) setConsentGranted(true)
      setLoading(false)
    })
    return () => { alive = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend() {
    if (!input.trim() || loading || consentGranted) return
    const userMsg: AIMessage = { role: 'user', content: input.trim() }
    setInput('')
    const history: AIMessage[] = [...messages, userMsg]
    setMessages(history)
    setLoading(true)
    const response = await callGemini(history, systemPrompt)
    const text = response.replace('[CONSENT_GRANTED]', '').trim()
    setMessages([...history, { role: 'model', content: text }])
    if (response.includes('[CONSENT_GRANTED]')) setConsentGranted(true)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-white">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-xl flex-shrink-0">🤖</div>
        <div className="flex-1">
          <p className="font-bold text-gray-900 text-sm">SafeHer AI</p>
          <p className="text-xs text-gray-400">Confidential · Private screening</p>
        </div>
        <button onClick={onClose} className="text-gray-400 text-lg px-1">✕</button>
      </div>

      {/* Privacy notice */}
      <div className="px-4 py-2 bg-blue-50 flex items-center gap-2">
        <span className="text-sm">🔒</span>
        <p className="text-xs text-blue-600">Your conversation is private. Contact details shared only after mutual consent.</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'model' && (
              <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-sm flex-shrink-0 mb-0.5">🤖</div>
            )}
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary-500 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-end gap-2">
            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-sm flex-shrink-0">🤖</div>
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 150, 300].map(delay => (
                  <span key={delay} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {consentGranted && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center mx-2">
            <p className="text-3xl mb-1">✅</p>
            <p className="font-semibold text-green-800 text-sm">Screening complete!</p>
            <p className="text-xs text-green-600 mt-1 mb-3">
              {isRequester ? 'Connecting you with your buddy...' : 'Thank you for agreeing to help!'}
            </p>
            <button
              onClick={onConsentGranted}
              className="bg-green-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl"
            >
              {isRequester ? 'Connect with Buddy' : 'Confirm & Help'}
            </button>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      {!consentGranted && (
        <div className="px-4 py-3 border-t border-gray-100 bg-white flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type your response..."
            disabled={loading}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
          >
            Send
          </button>
        </div>
      )}
    </div>
  )
}
