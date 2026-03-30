import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { IncidentReport } from '../../types'

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const sosIcon = L.divIcon({
  html: '<div style="background:#ef4444;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(239,68,68,0.8)"></div>',
  iconSize: [20, 20],
  className: '',
})

const incidentColors: Record<string, string> = {
  harassment: '#ef4444',
  suspicious: '#f97316',
  unsafe_area: '#eab308',
  other: '#6b7280',
}

interface Props {
  userLat?: number
  userLng?: number
  incidents?: IncidentReport[]
  centerLat?: number
  centerLng?: number
  zoom?: number
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lng], map.getZoom()) }, [lat, lng])
  return null
}

export default function CampusMap({
  userLat,
  userLng,
  incidents = [],
  centerLat = 12.9716,
  centerLng = 77.5946,
  zoom = 15,
}: Props) {
  return (
    <MapContainer
      center={[centerLat, centerLng]}
      zoom={zoom}
      className="w-full h-full rounded-2xl z-0"
      style={{ minHeight: '300px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* User location */}
      {userLat && userLng && (
        <>
          <Marker position={[userLat, userLng]} icon={sosIcon}>
            <Popup>Your location</Popup>
          </Marker>
          <Circle
            center={[userLat, userLng]}
            radius={30}
            pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.2 }}
          />
          <RecenterMap lat={userLat} lng={userLng} />
        </>
      )}

      {/* Incident heatmap markers */}
      {incidents.map((inc) =>
        inc.latitude && inc.longitude ? (
          <Circle
            key={inc.id}
            center={[inc.latitude, inc.longitude]}
            radius={50}
            pathOptions={{
              color: incidentColors[inc.category] ?? '#6b7280',
              fillColor: incidentColors[inc.category] ?? '#6b7280',
              fillOpacity: 0.3 + inc.severity * 0.1,
              weight: 1,
            }}
          >
            <Popup>
              <strong className="capitalize">{inc.category}</strong>
              <br />
              {inc.description}
              <br />
              <span className="text-xs text-gray-500">Severity: {inc.severity}/5</span>
            </Popup>
          </Circle>
        ) : null
      )}
    </MapContainer>
  )
}
