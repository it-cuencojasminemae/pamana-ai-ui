<script setup lang="ts">
import type { SelectedLocation } from '../../types/location'
import { resolveGpsLocation, selectedLocationAfterEdit } from '../../services/locationSearch'

const props = withDefaults(defineProps<{
  mode: 'origin' | 'destination'
  placeholder?: string
  initialQuery?: string
  allowCurrentLocation?: boolean
}>(), {
  placeholder: 'Search for a place',
  initialQuery: '',
  allowCurrentLocation: false,
})
const model = defineModel<SelectedLocation | null>({ default: null })
const emit = defineEmits<{ 'text-updated': [value: string] }>()
const { state, search, clear: clearSearch } = useLocationSearch()
const geoapify = useGeoapify()
const { location, error: geolocationError, loading: geolocationLoading, start: requestLocation } = useGeolocation()
const input = ref(model.value?.label || props.initialQuery)
const open = ref(false)
const activeIndex = ref(-1)
const localError = ref('')
const reverseAbort = shallowRef<AbortController | null>(null)
const pendingGps = ref(false)
const listId = `pamana-location-${useId()}`
let closeTimer: ReturnType<typeof setTimeout> | undefined

const showPanel = computed(() => open.value && (
  props.allowCurrentLocation || state.status !== 'idle' || state.suggestions.length > 0
))
const activeId = computed(() => activeIndex.value >= 0 ? `${listId}-option-${activeIndex.value}` : undefined)
const statusMessage = computed(() => {
  if (localError.value) return localError.value
  if (state.status === 'no-results') return 'No matching places found. Try a more specific place name.'
  if (state.status !== 'error') return ''
  if (state.error === 'MISSING_API_KEY' || state.error === 'INVALID_CONFIGURATION') return 'Location search is unavailable because map configuration is missing.'
  if (state.error === 'RATE_LIMITED') return 'Location search is busy. Please wait a moment and try again.'
  return 'Location search is temporarily unavailable.'
})

watch(() => props.initialQuery, value => {
  if (!model.value && value && value !== input.value) input.value = value
})
watch(model, value => {
  if (value && input.value !== value.label) input.value = value.label
})
watch(location, value => {
  if (pendingGps.value && value) void selectCurrentLocation()
})
watch(geolocationError, value => {
  if (!pendingGps.value || !value) return
  pendingGps.value = false
  localError.value = 'Current location is unavailable. Search for a starting place instead.'
  open.value = true
})

function handleInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  input.value = value
  localError.value = ''
  const retained = selectedLocationAfterEdit(model.value, value)
  if (model.value && !retained) model.value = null
  emit('text-updated', value)
  activeIndex.value = -1
  open.value = true
  search(value)
}

function handleFocus() {
  clearTimeout(closeTimer)
  open.value = true
  if (input.value.trim().length >= 2) search(input.value)
}

function scheduleClose() {
  clearTimeout(closeTimer)
  closeTimer = setTimeout(() => { open.value = false }, 150)
}

function choose(location: SelectedLocation) {
  model.value = location
  input.value = location.label
  emit('text-updated', location.label)
  open.value = false
  activeIndex.value = -1
  localError.value = ''
  clearSearch()
}

async function selectCurrentLocation() {
  if (!location.value) {
    pendingGps.value = !geolocationError.value
    requestLocation()
    localError.value = geolocationError.value ? 'Current location is unavailable. Search for a starting place instead.' : 'Waiting for browser location…'
    open.value = true
    return
  }
  pendingGps.value = false
  reverseAbort.value?.abort()
  const point = { latitude: location.value.lat, longitude: location.value.lng }
  // Select GPS immediately; reverse-geocoding only improves its secondary label.
  choose({ id: 'user-gps', label: 'Current Location', lat: point.latitude, lng: point.longitude, source: 'USER_GPS' })
  reverseAbort.value = new AbortController()
  const enriched = await resolveGpsLocation(point, geoapify.reverseGeocodeLocation, reverseAbort.value.signal)
  if (!reverseAbort.value.signal.aborted && model.value?.source === 'USER_GPS') model.value = enriched
}

function clearSelection() {
  reverseAbort.value?.abort()
  model.value = null
  input.value = ''
  localError.value = ''
  activeIndex.value = -1
  open.value = false
  emit('text-updated', '')
  clearSearch()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { open.value = false; activeIndex.value = -1; return }
  if (!state.suggestions.length) return
  if (event.key === 'ArrowDown') {
    event.preventDefault(); open.value = true
    activeIndex.value = (activeIndex.value + 1) % state.suggestions.length
  } else if (event.key === 'ArrowUp') {
    event.preventDefault(); open.value = true
    activeIndex.value = activeIndex.value <= 0 ? state.suggestions.length - 1 : activeIndex.value - 1
  } else if (event.key === 'Enter' && activeIndex.value >= 0) {
    event.preventDefault(); choose(state.suggestions[activeIndex.value])
  }
}

onBeforeUnmount(() => {
  clearTimeout(closeTimer)
  reverseAbort.value?.abort()
})
</script>

<template>
  <div class="location-search" :data-location-mode="mode">
    <div class="location-search__input-wrap">
      <UIcon :name="mode === 'origin' ? 'i-lucide-circle' : 'i-lucide-map-pin'" class="location-search__icon" />
      <input
        :value="input"
        type="text"
        autocomplete="off"
        :placeholder="placeholder"
        :aria-label="mode === 'origin' ? 'Trip origin' : 'Trip destination'"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="showPanel"
        :aria-controls="listId"
        :aria-activedescendant="activeId"
        @input="handleInput"
        @focus="handleFocus"
        @keydown="handleKeydown"
        @blur="scheduleClose"
      >
      <span v-if="state.status === 'loading'" class="location-search__spinner" aria-label="Searching places" />
      <button v-else-if="input" type="button" class="location-search__clear" aria-label="Clear selected location" @click="clearSelection">
        <UIcon name="i-lucide-x" />
      </button>
    </div>

    <div v-if="model" class="location-search__resolved">
      <UIcon name="i-lucide-check-circle-2" />
      <span>{{ model.formattedAddress || (model.source === 'USER_GPS' ? 'GPS coordinates selected' : 'Coordinates resolved') }}</span>
    </div>

    <div v-if="showPanel" :id="listId" class="location-search__panel" role="listbox" :aria-label="`${mode} place suggestions`">
      <button
        v-if="allowCurrentLocation"
        type="button"
        class="location-search__current"
        :disabled="geolocationLoading"
        @mousedown.prevent
        @click="selectCurrentLocation"
      >
        <UIcon name="i-lucide-locate-fixed" />
        <span><strong>Current Location</strong><small>{{ geolocationLoading ? 'Locating…' : geolocationError ? 'Permission unavailable — try again or search' : 'Use browser GPS' }}</small></span>
      </button>

      <div v-if="state.status === 'loading'" class="location-search__loading" role="status">
        <span /><span /><span />
      </div>
      <button
        v-for="(suggestion, index) in state.suggestions"
        :id="`${listId}-option-${index}`"
        :key="suggestion.id"
        type="button"
        role="option"
        :aria-selected="index === activeIndex"
        class="location-search__option"
        :class="{ 'location-search__option--active': index === activeIndex }"
        @mousedown.prevent
        @mouseenter="activeIndex = index"
        @click="choose(suggestion)"
      >
        <UIcon name="i-lucide-map-pin" />
        <span><strong>{{ suggestion.label }}</strong><small v-if="suggestion.formattedAddress && suggestion.formattedAddress !== suggestion.label">{{ suggestion.formattedAddress }}</small></span>
      </button>
      <p v-if="statusMessage" class="location-search__message" role="status">{{ statusMessage }}</p>
    </div>
  </div>
</template>

<style scoped>
.location-search { position: relative; width: 100%; }
.location-search__input-wrap { display: flex; align-items: center; gap: .65rem; min-height: 44px; padding: .35rem .7rem; border: 1px solid rgb(23 43 39 / 12%); border-radius: 14px; background: rgb(255 255 255 / 82%); transition: border-color .15s, box-shadow .15s; }
.location-search__input-wrap:focus-within { border-color: #65a30d; box-shadow: 0 0 0 4px rgb(163 230 53 / 15%); }
.location-search__icon { flex: none; color: #65a30d; }
.location-search input { min-width: 0; width: 100%; border: 0; outline: 0; background: transparent; color: #172b27; font: 600 14px/1.4 system-ui; }
.location-search input::placeholder { color: #94a3b8; font-weight: 500; }
.location-search__clear { display: grid; place-items: center; flex: none; width: 32px; height: 32px; border: 0; border-radius: 50%; background: transparent; color: #64748b; cursor: pointer; }
.location-search__clear:hover { background: #f1f5f9; }
.location-search__spinner { flex: none; width: 18px; height: 18px; border: 2px solid #d9e5dc; border-top-color: #4d7c0f; border-radius: 50%; animation: location-spin .7s linear infinite; }
.location-search__resolved { display: flex; gap: 5px; align-items: center; margin: 5px 4px 0; color: #52645f; font-size: 11px; line-height: 1.35; }
.location-search__resolved svg { flex: none; color: #15803d; }
.location-search__panel { position: absolute; z-index: 40; top: calc(100% + 7px); left: 0; right: 0; overflow: hidden; border: 1px solid #dbe4e0; border-radius: 15px; background: #fff; box-shadow: 0 18px 45px rgb(15 23 42 / 18%); }
.location-search__option, .location-search__current { display: flex; width: 100%; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 0; border-bottom: 1px solid #edf2f0; background: white; color: #172b27; text-align: left; cursor: pointer; }
.location-search__option:hover, .location-search__option--active, .location-search__current:hover { background: #f2f8e9; }
.location-search__option svg, .location-search__current svg { flex: none; margin-top: 2px; color: #65a30d; }
.location-search__option span, .location-search__current span { display: grid; min-width: 0; gap: 2px; }
.location-search__option strong, .location-search__current strong { overflow: hidden; font: 650 13px/1.35 system-ui; text-overflow: ellipsis; white-space: nowrap; }
.location-search__option small, .location-search__current small { display: -webkit-box; overflow: hidden; color: #64748b; font: 500 11px/1.35 system-ui; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.location-search__current:disabled { cursor: wait; opacity: .7; }
.location-search__loading { display: grid; gap: 6px; padding: 11px 12px; }
.location-search__loading span { height: 8px; border-radius: 9px; background: linear-gradient(90deg, #edf2f0, #f8faf9, #edf2f0); background-size: 200% 100%; animation: location-shimmer 1.2s infinite; }
.location-search__loading span:nth-child(2) { width: 82%; }.location-search__loading span:nth-child(3) { width: 64%; }
.location-search__message { margin: 0; padding: 11px 12px; color: #475569; font-size: 12px; line-height: 1.4; }
.location-search button:focus-visible, .location-search input:focus-visible { outline: 3px solid #2563eb; outline-offset: 2px; }
@keyframes location-spin { to { transform: rotate(360deg); } }
@keyframes location-shimmer { to { background-position: -200% 0; } }
@media (max-width: 480px) { .location-search__panel { position: fixed; top: auto; right: 12px; bottom: 12px; left: 12px; max-height: min(65vh, 430px); overflow-y: auto; } }
</style>
