let activeWatchId: number | null = null

export function useGeolocation({ autoStart = false }: { autoStart?: boolean } = {}) {
  const location = useState<{ lat: number; lng: number } | null>(
    'user-location',
    () => null
  )

  const error = useState<string | null>(
    'user-location-error',
    () => null
  )

  const loading = useState<boolean>(
    'user-location-loading',
    () => false
  )

  const requested = useState<boolean>(
    'user-location-requested',
    () => false
  )

  const observedAt = useState<string | null>('user-location-observed-at', () => null)
  const accuracy = useState<number | null>('user-location-accuracy', () => null)
  const speed = useState<number | null>('user-location-speed', () => null)
  const heading = useState<number | null>('user-location-heading', () => null)
  const tracking = useState<boolean>('user-location-tracking', () => false)

  function applyPosition(position: GeolocationPosition) {
    location.value = { lat: position.coords.latitude, lng: position.coords.longitude }
    observedAt.value = new Date(position.timestamp).toISOString()
    accuracy.value = position.coords.accuracy
    speed.value = position.coords.speed
    heading.value = position.coords.heading
    error.value = null
    loading.value = false
  }

  function applyError(geolocationError: GeolocationPositionError) {
    error.value = geolocationError.message
    loading.value = false
  }

  function start() {
    if (!import.meta.client) return

    if (!navigator.geolocation) {
      error.value = 'Geolocation is not supported by this browser.'
      return
    }

    // Prevent several map components from requesting location repeatedly.
    if (requested.value) return

    requested.value = true
    loading.value = true

    navigator.geolocation.getCurrentPosition(
      applyPosition,
      applyError,
      // maximumAge: 0 forces a fresh fix on every request instead of reusing a
      // cached browser position - relevant while diagnosing accuracy issues.
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    )
  }

  function startTracking() {
    if (!import.meta.client || activeWatchId !== null) return
    if (!navigator.geolocation) {
      error.value = 'Geolocation is not supported by this browser.'
      return
    }
    requested.value = true
    loading.value = true
    tracking.value = true
    activeWatchId = navigator.geolocation.watchPosition(applyPosition, applyError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000
    })
  }

  function stopTracking() {
    if (!import.meta.client || activeWatchId === null) return
    navigator.geolocation.clearWatch(activeWatchId)
    activeWatchId = null
    tracking.value = false
  }

  if (autoStart) onMounted(start)

  return {
    location,
    error,
    loading,
    observedAt,
    accuracy,
    speed,
    heading,
    tracking,
    start,
    startTracking,
    stopTracking
  }
}
