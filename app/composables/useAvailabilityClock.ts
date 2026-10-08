// One shared timer lets saved/cached reports expire even when API polling fails.
let timer: ReturnType<typeof setInterval> | undefined
let subscribers = 0
export function useAvailabilityClock() {
  const now = useState('availability-clock', () => Date.now())
  onMounted(() => {
    now.value = Date.now()
    subscribers++
    if (!timer) timer = setInterval(() => { now.value = Date.now() }, 15000)
  })
  onBeforeUnmount(() => {
    subscribers--
    if (!subscribers && timer) { clearInterval(timer); timer = undefined }
  })
  return now
}
