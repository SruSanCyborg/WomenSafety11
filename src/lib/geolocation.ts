export function getCurrentPosition(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  })
}

export function watchPosition(
  onUpdate: (lat: number, lng: number) => void,
  interval = 5000
): () => void {
  let watchId: number | null = null

  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      (pos) => onUpdate(pos.coords.latitude, pos.coords.longitude),
      (err) => console.error('Geolocation watch error:', err),
      { enableHighAccuracy: true, maximumAge: interval }
    )
  }

  return () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId)
  }
}

export function detectShake(onShake: () => void, threshold = 15): () => void {
  let lastX = 0, lastY = 0, lastZ = 0
  let shakeCount = 0
  let lastShakeTime = 0

  const handleMotion = (e: DeviceMotionEvent) => {
    const acc = e.accelerationIncludingGravity
    if (!acc) return

    const x = acc.x ?? 0
    const y = acc.y ?? 0
    const z = acc.z ?? 0
    const now = Date.now()

    const delta = Math.abs(x - lastX) + Math.abs(y - lastY) + Math.abs(z - lastZ)
    if (delta > threshold) {
      if (now - lastShakeTime < 500) {
        shakeCount++
        if (shakeCount >= 3) {
          onShake()
          shakeCount = 0
        }
      } else {
        shakeCount = 1
      }
      lastShakeTime = now
    }

    lastX = x; lastY = y; lastZ = z
  }

  window.addEventListener('devicemotion', handleMotion)
  return () => window.removeEventListener('devicemotion', handleMotion)
}
