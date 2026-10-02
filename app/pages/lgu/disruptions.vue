<script setup lang="ts">
import type { DisruptionEffect, DisruptionTargetOptions, StructuredDisruption, VerificationStatus } from '../../types/disruption'
import { DISRUPTION_EFFECT_OPTIONS, effectLabel, targetLabel } from '../../services/disruption'
import { disruptionMapFeatures } from '../../services/disruptionMapFeatures'

definePageMeta({ middleware: ['auth', 'lgu'] })
useHead({ title: 'Disruptions | PAMANA' })

const { apiFetch } = useApi()
const { isAdministrator } = useAuth()
const { location: userLocation } = useGeolocation()
const toast = useToast()

const TYPE_ICONS: Record<string, string> = {
  flood: 'i-lucide-cloud-rain', breakdown: 'i-lucide-wrench',
  road_closure: 'i-lucide-triangle-alert', accident: 'i-lucide-triangle-alert',
  weather: 'i-lucide-cloud', route_suspension: 'i-lucide-ban',
}
const typeOptions = [
  ['flood', 'Flood'], ['road_closure', 'Road closure'], ['accident', 'Accident'],
  ['weather', 'Weather'], ['route_suspension', 'Route suspension'], ['breakdown', 'Breakdown'],
]
const severityOptions = ['low', 'moderate', 'high', 'critical']
const verificationOptions: VerificationStatus[] = [
  'RESEARCH_CANDIDATE', 'CORROBORATED_RESEARCH', 'HISTORICAL_UNVERIFIED',
  'FIELD_VERIFIED', 'AUTHORITATIVE_CURRENT', 'SIMULATED_DEMO',
]
const geometrySourceOptions = [
  'UNKNOWN', 'FIELD_GPS', 'AUTHORITATIVE', 'GOOGLE_ROAD_MATCHED',
  'MANUAL_VERIFIED', 'SIMULATED',
]

function localDateTime(value = new Date()) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function blankForm() {
  return {
    type: 'road_closure', title: '', description: '', severity: 'moderate',
    startsAt: localDateTime(), endsAt: '', effect: 'WARNING_ONLY' as DisruptionEffect,
    routeId: '', variantId: '', nodeId: '', dataMode: 'SIMULATED' as 'REAL' | 'SIMULATED',
    verificationStatus: 'RESEARCH_CANDIDATE' as VerificationStatus, planningEnabled: false,
    verifiedAt: '', sourceName: '', sourceReference: '', notes: '',
    geometrySource: 'UNKNOWN', geometryText: '',
  }
}

const form = reactive(blankForm())
const rawDisruptions = ref<StructuredDisruption[]>([])
const mapDisruptions = computed(() => disruptionMapFeatures(rawDisruptions.value))
const targetOptions = ref<DisruptionTargetOptions>({ routes: [], variants: [], nodes: [] })
const loading = ref(true)
const saving = ref(false)
const resolvingId = ref<string | null>(null)
const resolutionNotes = ref('')

const filteredVariants = computed(() => form.routeId
  ? targetOptions.value.variants.filter(variant => variant.routeId === form.routeId)
  : targetOptions.value.variants)
const requiresRoute = computed(() => form.effect === 'ROUTE_SUSPENDED')
const requiresVariant = computed(() => form.effect === 'VARIANT_SUSPENDED')
const requiresNode = computed(() => ['NODE_CLOSED', 'BOARDING_CLOSED', 'ALIGHTING_CLOSED', 'TRANSFER_BLOCKED'].includes(form.effect))
const requiresRouteOrVariant = computed(() => form.effect === 'LIMITED_SERVICE')
const targetValid = computed(() => (!requiresRoute.value || Boolean(form.routeId))
  && (!requiresVariant.value || Boolean(form.variantId))
  && (!requiresNode.value || Boolean(form.nodeId))
  && (!requiresRouteOrVariant.value || Boolean(form.routeId || form.variantId)))
const canCreate = computed(() => Boolean(form.title.trim() && form.startsAt && targetValid.value && !saving.value))

watch(() => form.routeId, (routeId) => {
  if (form.variantId && routeId && !filteredVariants.value.some(variant => variant.id === form.variantId)) {
    form.variantId = ''
  }
})

function formatReportedAt(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return date.toDateString() === now.toDateString()
    ? `Reported ${time}`
    : `Reported ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`
}

const disruptions = computed(() => rawDisruptions.value.map(item => {
  const isResolved = item.disruption_status !== 'active'
  const tone = isResolved ? 'lime' : ['critical', 'high'].includes(item.severity) ? 'red' : 'amber'
  return {
    id: item.documentId,
    title: item.title,
    detail: `${formatReportedAt(item.starts_at)} · ${item.description || item.disruption_status}`,
    severity: isResolved ? 'Resolved' : `${item.severity.charAt(0).toUpperCase()}${item.severity.slice(1)} severity`,
    tone,
    icon: TYPE_ICONS[item.type] ?? 'i-lucide-triangle-alert',
    acknowledged: isResolved,
    dataMode: item.data_mode === 'REAL' ? 'REAL' : 'SIMULATED',
    effect: effectLabel(item.effect),
    target: targetLabel(item),
    planningEnabled: item.planning_enabled === true,
    verificationStatus: item.verification_status || 'Legacy / unverified',
    resolutionNotes: item.resolution_notes || null,
  }
}))

async function loadPage() {
  loading.value = true
  try {
    const [records, options] = await Promise.all([
      apiFetch<{ data: StructuredDisruption[] }>('/api/disruptions', {
        query: { sort: 'starts_at:desc', populate: '*' },
      }),
      apiFetch<{ data: DisruptionTargetOptions }>('/api/disruption-target-options'),
    ])
    rawDisruptions.value = records.data
    targetOptions.value = options.data
  } catch {
    rawDisruptions.value = []
    toast.add({ title: 'Unable to load disruptions', description: 'Please try again.', color: 'error' })
  } finally {
    loading.value = false
  }
}

async function createDisruption() {
  if (!canCreate.value) return
  saving.value = true
  try {
    let geometry: Record<string, unknown> | null = null
    if (form.geometryText.trim()) {
      try { geometry = JSON.parse(form.geometryText) }
      catch { throw new Error('Geometry must be valid GeoJSON.') }
    }
    const data: Record<string, unknown> = {
      type: form.type, title: form.title.trim(), description: form.description.trim() || null,
      severity: form.severity, starts_at: new Date(form.startsAt).toISOString(),
      ends_at: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      effect: form.effect, affected_route: form.routeId || null,
      affected_route_variant: form.variantId || null,
      affected_transport_node: form.nodeId || null, data_mode: form.dataMode,
      source_name: form.sourceName.trim() || null, source_reference: form.sourceReference.trim() || null,
      notes: form.notes.trim() || null, geometry_source: form.geometrySource,
      geometry_geojson: geometry,
    }
    if (isAdministrator.value) {
      Object.assign(data, {
        verification_status: form.verificationStatus,
        planning_enabled: form.planningEnabled,
        verified_at: form.verifiedAt ? new Date(form.verifiedAt).toISOString() : null,
      })
    }
    await apiFetch('/api/disruptions', { method: 'POST', body: { data } })
    Object.assign(form, blankForm())
    toast.add({ title: 'Disruption recorded', description: 'Structured targets were saved without changing journey planning.', color: 'success' })
    await loadPage()
  } catch (error: any) {
    toast.add({
      title: 'Unable to save disruption',
      description: error?.message || error?.data?.error?.message || 'Review the effect, target, and evidence fields.',
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}

function beginResolution(id: string) {
  resolvingId.value = id
  resolutionNotes.value = ''
}

async function resolveDisruption(id: string) {
  if (!resolutionNotes.value.trim()) {
    toast.add({ title: 'Add resolution details', description: 'Record how the disruption was resolved.', color: 'warning' })
    return
  }
  try {
    const resolvedAt = new Date().toISOString()
    await apiFetch(`/api/disruptions/${id}`, {
      method: 'PUT',
      body: { data: { disruption_status: 'resolved', ends_at: resolvedAt, resolved_at: resolvedAt, resolution_notes: resolutionNotes.value.trim() } },
    })
    resolvingId.value = null
    resolutionNotes.value = ''
    toast.add({ title: 'Disruption resolved', description: 'Resolution time and details were recorded.', color: 'success' })
    await loadPage()
  } catch (error: any) {
    toast.add({ title: 'Unable to resolve disruption', description: error?.data?.error?.message || 'Please try again.', color: 'error' })
  }
}

onMounted(loadPage)
</script>

<template>
  <div>
    <PamanaPageHeader title="Disruptions" role="lgu" />

    <UCard class="glass mb-5 rounded-30" :ui="{ root: 'ring-0 rounded-30' }">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="font-display text-base font-semibold text-neutral-900">Record a structured disruption</h2>
          <p class="mt-1 text-xs text-neutral-500">Targets use exact PAMANA records. Text and coordinates never choose a route or stop.</p>
        </div>
        <span class="pill bg-amber-100 text-amber-700">Verified disruptions affect journey planning</span>
      </div>

      <form class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3" @submit.prevent="createDisruption">
        <label class="grid gap-1 text-xs font-medium text-neutral-600">Title
          <input v-model="form.title" class="min-h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm" required>
        </label>
        <label class="grid gap-1 text-xs font-medium text-neutral-600">Type
          <select v-model="form.type" class="min-h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm">
            <option v-for="option in typeOptions" :key="option[0]" :value="option[0]">{{ option[1] }}</option>
          </select>
        </label>
        <label class="grid gap-1 text-xs font-medium text-neutral-600">Severity
          <select v-model="form.severity" class="min-h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm">
            <option v-for="option in severityOptions" :key="option" :value="option">{{ option }}</option>
          </select>
        </label>
        <label class="grid gap-1 text-xs font-medium text-neutral-600 md:col-span-2 xl:col-span-3">Description
          <textarea v-model="form.description" rows="2" class="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm" />
        </label>

        <label class="grid gap-1 text-xs font-medium text-neutral-600">Deterministic effect
          <select v-model="form.effect" class="min-h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm">
            <option v-for="option in DISRUPTION_EFFECT_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <label class="grid gap-1 text-xs font-medium text-neutral-600">Affected route <span v-if="requiresRoute" class="text-red-600">required</span>
          <select v-model="form.routeId" class="min-h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm">
            <option value="">No route target</option>
            <option v-for="route in targetOptions.routes" :key="route.id" :value="route.id">{{ route.name }} · {{ route.code }}</option>
          </select>
        </label>
        <label class="grid gap-1 text-xs font-medium text-neutral-600">Affected route variant <span v-if="requiresVariant" class="text-red-600">required</span>
          <select v-model="form.variantId" class="min-h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm">
            <option value="">No variant target</option>
            <option v-for="variant in filteredVariants" :key="variant.id" :value="variant.id">{{ variant.name }} · {{ variant.direction }}</option>
          </select>
        </label>
        <label class="grid gap-1 text-xs font-medium text-neutral-600">Affected transport node <span v-if="requiresNode" class="text-red-600">required</span>
          <select v-model="form.nodeId" class="min-h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm">
            <option value="">No node target</option>
            <option v-for="node in targetOptions.nodes" :key="node.id" :value="node.id">{{ node.name }} · {{ node.code }}</option>
          </select>
        </label>
        <label class="grid gap-1 text-xs font-medium text-neutral-600">Starts at
          <input v-model="form.startsAt" type="datetime-local" class="min-h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm" required>
        </label>
        <label class="grid gap-1 text-xs font-medium text-neutral-600">Ends at
          <input v-model="form.endsAt" type="datetime-local" :min="form.startsAt" class="min-h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm">
        </label>
        <label class="grid gap-1 text-xs font-medium text-neutral-600">Data mode
          <select v-model="form.dataMode" class="min-h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm"><option>SIMULATED</option><option>REAL</option></select>
        </label>

        <template v-if="isAdministrator">
          <label class="grid gap-1 text-xs font-medium text-neutral-600">Verification status
            <select v-model="form.verificationStatus" class="min-h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm">
              <option v-for="option in verificationOptions" :key="option" :value="option">{{ option }}</option>
            </select>
          </label>
          <label class="grid gap-1 text-xs font-medium text-neutral-600">Verified at
            <input v-model="form.verifiedAt" type="datetime-local" class="min-h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm">
          </label>
          <label class="flex min-h-11 items-center gap-2 self-end rounded-xl border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700">
            <input v-model="form.planningEnabled" type="checkbox"> Eligible to affect journey planning
          </label>
        </template>

        <label class="grid gap-1 text-xs font-medium text-neutral-600">Evidence source
          <input v-model="form.sourceName" class="min-h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="Agency or field team">
        </label>
        <label class="grid gap-1 text-xs font-medium text-neutral-600 md:col-span-2">Evidence reference
          <input v-model="form.sourceReference" class="min-h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="Advisory number or internal reference">
        </label>
        <label class="grid gap-1 text-xs font-medium text-neutral-600">Geometry source
          <select v-model="form.geometrySource" class="min-h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm">
            <option v-for="option in geometrySourceOptions" :key="option" :value="option">{{ option }}</option>
          </select>
        </label>
        <label class="grid gap-1 text-xs font-medium text-neutral-600 md:col-span-2">Optional GeoJSON geometry
          <textarea v-model="form.geometryText" rows="2" class="rounded-xl border border-neutral-200 bg-white px-3 py-2 font-mono text-xs" placeholder='{"type":"Point","coordinates":[120.7,15.1]}' />
        </label>
        <label class="grid gap-1 text-xs font-medium text-neutral-600 md:col-span-2 xl:col-span-3">Internal notes
          <textarea v-model="form.notes" rows="2" class="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm" />
        </label>

        <div class="flex items-center justify-between gap-3 md:col-span-2 xl:col-span-3">
          <p v-if="!targetValid" class="text-xs text-red-600">Choose the explicit target required by this effect.</p>
          <span v-else />
          <UButton type="submit" icon="i-lucide-plus" class="rounded-full" :loading="saving" :disabled="!canCreate">Record disruption</UButton>
        </div>
      </form>
    </UCard>

    <div class="grid gap-5 lg:grid-cols-3">
      <div class="space-y-3 lg:col-span-2">
        <UCard v-if="loading" class="glass rounded-30 animate-pulse" :ui="{ root: 'ring-0 rounded-30' }"><div class="h-16" /></UCard>
        <UCard v-else-if="!disruptions.length" class="glass rounded-30" :ui="{ root: 'ring-0 rounded-30' }">
          <p class="py-5 text-center text-sm text-neutral-500">No disruptions have been recorded.</p>
        </UCard>
        <UCard v-for="item in disruptions" :key="item.id" class="glass card-lift rounded-30" :class="item.tone === 'lime' ? 'opacity-65' : ''" :ui="{ root: 'ring-0 rounded-30' }">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
            <span class="flex size-10 shrink-0 items-center justify-center rounded-full" :class="{ 'bg-red-100 text-red-600': item.tone === 'red', 'bg-amber-100 text-amber-700': item.tone === 'amber', 'bg-lime-300/20 text-lime-700': item.tone === 'lime' }"><UIcon :name="item.icon" class="size-4" /></span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-sm font-semibold text-neutral-900">{{ item.title }}</h2>
                <span class="pill" :class="{ 'bg-red-100 text-red-600': item.tone === 'red', 'bg-amber-100 text-amber-700': item.tone === 'amber', 'bg-lime-300/15 text-lime-700': item.tone === 'lime' }">{{ item.severity }}</span>
                <span class="pill" :class="item.dataMode === 'SIMULATED' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'">{{ item.dataMode }}</span>
                <span v-if="item.planningEnabled" class="pill bg-blue-100 text-blue-700">PLANNING ELIGIBLE</span>
              </div>
              <p class="mt-1 text-xs text-neutral-400">{{ item.detail }}</p>
              <p class="mt-2 text-xs text-neutral-600"><strong>{{ item.effect }}</strong> · {{ item.target }}</p>
              <p class="mt-1 text-[10px] text-neutral-400">Verification: {{ item.verificationStatus }}</p>
              <p v-if="item.resolutionNotes" class="mt-2 rounded-xl bg-lime-50 px-3 py-2 text-xs text-lime-800">Resolution: {{ item.resolutionNotes }}</p>
              <div v-if="resolvingId === item.id" class="mt-3 grid gap-2">
                <textarea v-model="resolutionNotes" rows="2" class="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm" placeholder="Resolution details" />
                <div class="flex gap-2"><UButton size="sm" color="success" @click="resolveDisruption(item.id)">Confirm resolution</UButton><UButton size="sm" color="neutral" variant="soft" @click="resolvingId = null">Cancel</UButton></div>
              </div>
            </div>
            <button v-if="item.tone !== 'lime' && resolvingId !== item.id" type="button" class="btn-soft shrink-0 text-xs" :disabled="item.acknowledged" @click="beginResolution(item.id)">Resolve</button>
          </div>
        </UCard>
      </div>

      <PamanaMapPanel provider="maplibre" icon="i-lucide-map-pin" label="Disruption locations" height="340px" tone="red" :disruptions="mapDisruptions" :user-location="userLocation" />
    </div>
  </div>
</template>
