<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'passenger'] })
useHead({ title: 'My Reports | PAMANA' })

const { apiFetch } = useApi()
const pageRoute = useRoute()
const toast = useToast()
const geolocation = useGeolocation({ autoStart: false })

const categories = [
  { value: 'VEHICLE_FULL', label: 'Vehicle full', icon: 'i-lucide-users' },
  { value: 'LONG_WAIT', label: 'Long wait', icon: 'i-lucide-clock-3' },
  { value: 'NO_SERVICE_OBSERVED', label: 'No vehicle observed', icon: 'i-lucide-bus-front' },
  { value: 'STOP_ISSUE', label: 'Stop issue', icon: 'i-lucide-map-pin' },
  { value: 'ROUTE_INFORMATION_ISSUE', label: 'Route information', icon: 'i-lucide-route' },
  { value: 'ACCESSIBILITY_ISSUE', label: 'Accessibility', icon: 'i-lucide-accessibility' },
  { value: 'DISRUPTION', label: 'Disruption', icon: 'i-lucide-triangle-alert' },
  { value: 'OTHER', label: 'Other issue', icon: 'i-lucide-message-circle-warning' },
] as const

interface Relation { documentId?: string; route_code?: string; variant_code?: string; node_code?: string; name?: string; display_name?: string; vehicle_number?: string }
interface ReportRecord {
  id?: number; documentId: string; report_type: string; description?: string | null
  location_note?: string | null; reported_at?: string | null; createdAt?: string
  review_status?: 'PENDING' | 'REVIEWED' | 'VERIFIED' | 'DISMISSED'
  route?: Relation | null; route_variant?: Relation | null; transport_node?: Relation | null
}

const queryText = (value: unknown) => Array.isArray(value) ? String(value[0] || '') : typeof value === 'string' ? value : ''
const context = computed(() => ({
  route: queryText(pageRoute.query.route),
  route_variant: queryText(pageRoute.query.variant),
  transport_node: queryText(pageRoute.query.node),
  label: queryText(pageRoute.query.context),
}))
const hasContext = computed(() => Boolean(context.value.route || context.value.route_variant || context.value.transport_node))

const selectedCategory = ref('LONG_WAIT')
const description = ref('')
const locationNote = ref('')
const includeLocation = ref(false)
const submitting = ref(false)
const loading = ref(true)
const reports = ref<ReportRecord[]>([])

const categoryFor = (value: string) => categories.find(item => item.value === value)
const statusMeta: Record<string, { label: string; classes: string }> = {
  PENDING: { label: 'Pending review', classes: 'bg-amber-100 text-amber-800' },
  REVIEWED: { label: 'Reviewed', classes: 'bg-blue-100 text-blue-700' },
  VERIFIED: { label: 'Report verified', classes: 'bg-emerald-100 text-emerald-700' },
  DISMISSED: { label: 'Dismissed', classes: 'bg-neutral-200 text-neutral-700' },
}

function formatDate(value?: string | null) {
  if (!value) return 'Recently'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Recently'
}

async function loadReports() {
  loading.value = true
  try {
    const response = await apiFetch<{ data: ReportRecord[] }>('/api/passenger-reports', {
      query: { sort: 'reported_at:desc', 'pagination[pageSize]': 50 },
    })
    reports.value = Array.isArray(response?.data) ? response.data : []
  } catch {
    reports.value = []
    toast.add({ title: 'Unable to load reports', description: 'Please refresh and try again.', color: 'error' })
  } finally { loading.value = false }
}

function requestLocation() {
  includeLocation.value = true
  geolocation.start()
}

function clearLocation() {
  includeLocation.value = false
  locationNote.value = ''
}

async function submitReport() {
  const text = description.value.trim()
  if (text.length < 10 || text.length > 500) {
    toast.add({ title: 'Add a short description', description: 'Use 10 to 500 characters.', color: 'warning' })
    return
  }
  if (includeLocation.value && !geolocation.location.value) {
    toast.add({ title: 'Location is not ready', description: 'Wait for GPS, retry, or remove the location.', color: 'warning' })
    return
  }
  submitting.value = true
  try {
    const data: Record<string, unknown> = {
      report_type: selectedCategory.value,
      description: text,
      location_note: locationNote.value.trim() || null,
      context_source: hasContext.value ? 'SELECTED_JOURNEY' : 'NONE',
    }
    if (hasContext.value) {
      if (context.value.route) data.route = context.value.route
      if (context.value.route_variant) data.route_variant = context.value.route_variant
      if (context.value.transport_node) data.transport_node = context.value.transport_node
    }
    if (includeLocation.value && geolocation.location.value) {
      data.latitude = geolocation.location.value.lat
      data.longitude = geolocation.location.value.lng
      data.location_accuracy_m = geolocation.accuracy.value
    }
    await apiFetch('/api/passenger-reports', { method: 'POST', body: { data } })
    description.value = ''
    locationNote.value = ''
    includeLocation.value = false
    toast.add({ title: 'Report submitted', description: 'Your observation is pending human review.', color: 'success' })
    await loadReports()
  } catch (error: any) {
    toast.add({ title: 'Unable to submit report', description: error?.data?.error?.message || 'Review the details and try again.', color: 'error' })
  } finally { submitting.value = false }
}

onMounted(loadReports)
</script>

<template>
  <div>
    <PamanaPageHeader title="My Reports" role="passenger" />
    <UAlert color="neutral" variant="soft" icon="i-lucide-shield-check" title="Reports are evidence" description="Passenger observations are reviewed separately and never change verified routes, fares, occupancy, or disruptions automatically." class="mb-5 rounded-2xl" />

    <div class="grid gap-5 lg:grid-cols-5">
      <UCard class="glass glow-lime h-fit rounded-30 lg:col-span-2" :ui="{ root: 'ring-0 rounded-30', body: 'relative z-10' }">
        <h2 class="font-display text-base font-semibold text-neutral-900">Report a transport issue</h2>
        <p class="mt-1 text-xs text-neutral-500">Share what you observed. Avoid names, phone numbers, or other personal details.</p>

        <div v-if="hasContext" class="mt-4 rounded-2xl border border-lime-200 bg-lime-50 p-3">
          <p class="text-[10px] font-bold uppercase tracking-wide text-lime-700">Selected journey context</p>
          <p class="mt-1 text-sm font-semibold text-neutral-800">{{ context.label || 'Verified PAMANA journey' }}</p>
          <p class="mt-1 text-xs text-neutral-600">The server will verify these exact records before attaching them.</p>
        </div>

        <form class="mt-5 space-y-4" @submit.prevent="submitReport">
          <label class="grid gap-1 text-xs font-semibold text-neutral-700">Description
            <textarea v-model="description" rows="4" maxlength="500" required class="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-lime-500" placeholder="Describe what you observed and when." />
            <span class="text-right text-[10px] font-normal text-neutral-400">{{ description.length }}/500</span>
          </label>

          <label class="grid gap-1 text-xs font-semibold text-neutral-700">Location description <span class="font-normal text-neutral-400">optional</span>
            <input v-model="locationNote" maxlength="160" class="min-h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-normal outline-none focus:border-lime-500" placeholder="Stop, road, barangay, or landmark">
          </label>

          <fieldset>
            <legend class="text-xs font-semibold text-neutral-700">What did you observe?</legend>
            <div class="mt-2 grid grid-cols-2 gap-2">
              <button v-for="category in categories" :key="category.value" type="button" class="flex min-h-16 sm:min-h-20 flex-col items-center justify-center rounded-xl border px-2 py-2 text-center text-xs font-semibold transition focus-visible:outline-3 focus-visible:outline-blue-600" :class="selectedCategory === category.value ? 'border-lime-500 bg-lime-50 text-lime-800' : 'border-neutral-200 bg-white/70 text-neutral-600 hover:border-lime-300'" @click="selectedCategory = category.value">
                <UIcon :name="category.icon" class="mb-1 size-5" />{{ category.label }}
              </button>
            </div>
          </fieldset>

          <div class="rounded-2xl border border-neutral-200 bg-white/70 p-3">
            <div class="flex items-center justify-between gap-3">
              <div><p class="text-xs font-semibold text-neutral-800">Optional current location</p><p class="mt-0.5 text-[11px] text-neutral-500">GPS is requested only when you press the button.</p></div>
              <UButton v-if="!includeLocation" type="button" size="sm" color="neutral" variant="soft" icon="i-lucide-locate-fixed" :loading="geolocation.loading.value" @click="requestLocation">Use location</UButton>
              <UButton v-else type="button" size="sm" color="neutral" variant="ghost" icon="i-lucide-x" @click="clearLocation">Remove</UButton>
            </div>
            <p v-if="includeLocation" class="mt-2 text-xs" :class="geolocation.error.value ? 'text-amber-700' : 'text-lime-700'">{{ geolocation.error.value ? 'Location unavailable. Remove it or retry.' : geolocation.location.value ? 'Location attached privately for reviewers.' : 'Requesting location…' }}</p>
          </div>

          <UButton type="submit" block size="lg" icon="i-lucide-send" class="rounded-full font-semibold" :loading="submitting" :disabled="submitting || description.trim().length < 10">Submit report</UButton>
        </form>
      </UCard>

      <section class="space-y-3 lg:col-span-3" aria-labelledby="report-history-title">
        <div class="flex items-center justify-between"><h2 id="report-history-title" class="font-display text-base font-semibold text-neutral-900">Your report history</h2><span class="pill bg-neutral-100 text-neutral-600">{{ reports.length }}</span></div>
        <UCard v-if="loading" class="glass rounded-30 animate-pulse" :ui="{ root: 'ring-0 rounded-30' }"><div class="h-20" /></UCard>
        <UCard v-else-if="!reports.length" class="glass rounded-30" :ui="{ root: 'ring-0 rounded-30' }"><div class="py-8 text-center"><UIcon name="i-lucide-clipboard-list" class="mx-auto size-8 text-neutral-400" /><p class="mt-2 text-sm text-neutral-500">No reports yet.</p></div></UCard>
        <UCard v-for="report in reports" :key="report.documentId || report.id" class="glass rounded-30" :ui="{ root: 'ring-0 rounded-30' }">
          <div class="flex items-start gap-3">
            <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-lime-700"><UIcon :name="categoryFor(report.report_type)?.icon || 'i-lucide-info'" class="size-5" /></span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2"><h3 class="text-sm font-semibold text-neutral-900">{{ categoryFor(report.report_type)?.label || report.report_type }}</h3><span class="pill normal-case" :class="statusMeta[report.review_status || 'PENDING']?.classes">{{ statusMeta[report.review_status || 'PENDING']?.label }}</span></div>
              <p class="mt-1 text-sm text-neutral-700">{{ report.description || report.location_note || 'Legacy passenger observation' }}</p>
              <p class="mt-2 text-xs text-neutral-400">{{ formatDate(report.reported_at || report.createdAt) }}<span v-if="report.location_note"> · {{ report.location_note }}</span></p>
              <p v-if="report.route_variant || report.transport_node" class="mt-2 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-600">Context: {{ report.route_variant?.display_name || report.route_variant?.variant_code || report.route?.route_code || 'Journey' }}<span v-if="report.transport_node"> · {{ report.transport_node.name || report.transport_node.node_code }}</span></p>
            </div>
          </div>
        </UCard>
      </section>
    </div>
  </div>
</template>
