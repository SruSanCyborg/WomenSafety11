import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { getCurrentPosition, watchPosition } from '../lib/geolocation'
import { useAuth } from '../contexts/AuthContext'
import type { IncidentReport } from '../types'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const userIcon = L.divIcon({
  html: '<div style="background:#db2777;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(219,39,119,0.6)"></div>',
  iconSize: [16, 16],
  className: '',
})

const incidentColors: Record<string, string> = {
  harassment: '#ef4444',
  suspicious: '#f97316',
  unsafe_area: '#eab308',
  other: '#6b7280',
}

interface SafeRoute {
  id: string
  name: string
  route_geojson: { coordinates: [number, number][] }
  is_verified: boolean
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lng], map.getZoom()) }, [lat, lng])
  return null
}

export default function MapPage() {
  const { user } = useAuth()
  const [incidents, setIncidents] = useState<IncidentReport[]>([])
  const [routes, setRoutes] = useState<SafeRoute[]>([])
  const [userLat, setUserLat] = useState<number | undefined>()
  const [userLng, setUserLng] = useState<number | undefined>()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'map' | 'routes'>('map')
  const [newRouteName, setNewRouteName] = useState('')
  const [savingRoute, setSavingRoute] = useState(false)
  const [recordingPoints, setRecordingPoints] = useState<[number, number][]>([])
  const [isRecording, setIsRecording] = useState(false)

  // Ref so the watchPosition callback always sees the latest value (fixes stale closure bug)
  const isRecordingRef = useRef(false)
  const recordingPointsRef = useRef<[number, number][]>([])

  useEffect(() => {
    Promise.all([
      supabase.from('incident_reports').select('*').eq('status', 'verified'),
      supabase.from('safe_routes').select('*').order('created_at', { ascending: false }),
    ]).then(([inc, rt]) => {
      setIncidents(inc.data ?? [])
      setRoutes(rt.data ?? [])
      setLoading(false)
    })

    getCurrentPosition().then(c => {
      setUserLat(c.latitude)
      setUserLng(c.longitude)
    }).catch(() => {})

    const stop = watchPosition((lat, lng) => {
      setUserLat(lat)
      setUserLng(lng)
      if (isRecordingRef.current) {
        const point: [number, number] = [lng, lat]
        recordingPointsRef.current = [...recordingPointsRef.current, point]
        setRecordingPoints([...recordingPointsRef.current])
      }
    }, 3000)

    return stop
  }, [])

  function startRecording() {
    recordingPointsRef.current = []
    setRecordingPoints([])
    isRecordingRef.current = true
    setIsRecording(true)
    // Add current position as first point immediately
    if (userLat && userLng) {
      const point: [number, number] = [userLng, userLat]
      recordingPointsRef.current = [point]
      setRecordingPoints([point])
    }
  }

  function stopRecording() {
    isRecordingRef.current = false
    setIsRecording(false)
  }

  async function saveRoute() {
    if (!user || recordingPointsRef.current.length < 2 || !newRouteName.trim()) return
    setSavingRoute(true)
    const { data } = await supabase.from('safe_routes').insert({
      user_id: user.id,
      name: newRouteName.trim(),
      route_geojson: { type: 'LineString', coordinates: recordingPointsRef.current },
    }).select().single()
    if (data) setRoutes(prev => [data, ...prev])
    recordingPointsRef.current = []
    setRecordingPoints([])
    isRecordingRef.current = false
    setIsRecording(false)
    setNewRouteName('')
    setSavingRoute(false)
  }

  async function deleteRoute(id: string) {
    await supabase.from('safe_routes').delete().eq('id', id)
    setRoutes(prev => prev.filter(r => r.id !== id))
  }

  const center: [number, number] = [userLat ?? 12.9716, userLng ?? 77.5946]

  return (
    <div className="py-4 flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Campus Safety Map</h1>
        <p className="text-sm text-gray-500">Incidents, safe routes, and your location</p>
      </div>

      <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
        {(['map', 'routes'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${tab === t ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500'}`}>
            {t === 'map' ? '🗺 Live Map' : '🛤 Safe Routes'}
          </button>
        ))}
      </div>

      {tab === 'map' && (
        <>
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: '360px' }}>
            {loading ? (
              <div className="h-full flex items-center justify-center bg-gray-100">
                <p className="text-sm text-gray-500">Loading map...</p>
              </div>
            ) : (
              <MapContainer center={center} zoom={15} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {userLat && userLng && (
                  <>
                    <Marker position={[userLat, userLng]} icon={userIcon}>
                      <Popup>📍 You are here</Popup>
                    </Marker>
                    <Circle center={[userLat, userLng]} radius={25}
                      pathOptions={{ color: '#db2777', fillColor: '#db2777', fillOpacity: 0.15, weight: 2 }} />
                    <RecenterMap lat={userLat} lng={userLng} />
                  </>
                )}
                {incidents.map(inc => inc.latitude && inc.longitude ? (
                  <Circle key={inc.id} center={[inc.latitude, inc.longitude]} radius={60}
                    pathOptions={{ color: incidentColors[inc.category] ?? '#6b7280', fillColor: incidentColors[inc.category] ?? '#6b7280', fillOpacity: 0.25 + inc.severity * 0.08, weight: 1 }}>
                    <Popup>
                      <strong className="capitalize">{inc.category.replace('_', ' ')}</strong><br />
                      {inc.description}<br />
                      <span className="text-xs text-gray-500">Severity: {inc.severity}/5</span>
                    </Popup>
                  </Circle>
                ) : null)}
                {routes.map(route => (
                  <Polyline key={route.id}
                    positions={route.route_geojson.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])}
                    pathOptions={{ color: route.is_verified ? '#22c55e' : '#3b82f6', weight: 4, opacity: 0.8, dashArray: route.is_verified ? undefined : '8 4' }}>
                    <Popup>
                      {route.is_verified ? '✅' : '🔵'} <strong>{route.name}</strong><br />
                      <span className="text-xs">{route.is_verified ? 'Verified safe route' : 'User route'}</span>
                    </Popup>
                  </Polyline>
                ))}
                {/* Show live recording path */}
                {recordingPoints.length > 1 && (
                  <Polyline
                    positions={recordingPoints.map(([lng, lat]) => [lat, lng] as [number, number])}
                    pathOptions={{ color: '#f97316', weight: 5, opacity: 0.9, dashArray: '6 3' }}
                  />
                )}
              </MapContainer>
            )}
          </div>

          {/* Legend */}
          <div className="card">
            <p className="font-semibold text-sm mb-3">Legend</p>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-pink-500" /><span className="text-xs text-gray-600">Your location</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500" /><span className="text-xs text-gray-600">Harassment</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-500" /><span className="text-xs text-gray-600">Suspicious</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-500" /><span className="text-xs text-gray-600">Unsafe area</span></div>
              <div className="flex items-center gap-2"><span className="w-4 h-1 bg-green-500 rounded" /><span className="text-xs text-gray-600">Verified safe route</span></div>
              <div className="flex items-center gap-2"><span className="w-4 h-1 bg-blue-500 rounded" /><span className="text-xs text-gray-600">User route</span></div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Incidents', value: incidents.length },
              { label: 'High Risk', value: incidents.filter(i => i.severity >= 4).length },
              { label: 'Safe Routes', value: routes.length },
            ].map(s => (
              <div key={s.label} className="card text-center">
                <p className="text-2xl font-black text-primary-600">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'routes' && (
        <div className="space-y-4">
          <div className="card space-y-3 border-2 border-primary-100">
            <p className="font-bold text-gray-800">Record New Safe Route</p>
            <p className="text-xs text-gray-500">Walk your path — GPS points are captured automatically every 3 seconds.</p>

            {!isRecording ? (
              <button onClick={startRecording} className="btn-primary w-full">
                🔴 Start Recording Route
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-red-600 font-semibold animate-pulse">
                  <span className="w-2 h-2 bg-red-500 rounded-full" />
                  Recording... {recordingPoints.length} point{recordingPoints.length !== 1 ? 's' : ''} captured
                </div>
                <input type="text" className="input" placeholder="Route name (e.g. Library → Hostel Block A)"
                  value={newRouteName} onChange={e => setNewRouteName(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={saveRoute} disabled={savingRoute || recordingPoints.length < 2 || !newRouteName.trim()}
                    className="flex-1 btn-primary text-sm disabled:opacity-50">
                    {savingRoute ? 'Saving...' : '💾 Save Route'}
                  </button>
                  <button onClick={stopRecording}
                    className="flex-1 bg-gray-100 text-gray-600 font-semibold py-2 px-4 rounded-lg text-sm">
                    ⏹ Stop
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-gray-700 text-sm">Saved Routes ({routes.length})</p>
            {routes.length === 0 && (
              <div className="card text-center py-8">
                <p className="text-3xl mb-2">🛤</p>
                <p className="text-gray-500 text-sm">No routes yet. Record your first safe route above!</p>
              </div>
            )}
            {routes.map(route => (
              <div key={route.id} className="card flex items-center gap-3">
                <span className="text-2xl">{route.is_verified ? '✅' : '🔵'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 truncate">{route.name}</p>
                  <p className="text-xs text-gray-400">
                    {route.is_verified ? 'Verified by admin' : 'Pending verification'}
                    {' · '}{route.route_geojson.coordinates.length} points
                  </p>
                </div>
                <button onClick={() => deleteRoute(route.id)} className="text-red-400 text-sm hover:text-red-600">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
