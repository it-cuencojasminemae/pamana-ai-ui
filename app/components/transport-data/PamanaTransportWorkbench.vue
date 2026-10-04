<script setup lang="ts">
import type { MapLineFeature, MapPointFeature } from '../../types/map'
import type { SelectedLocation } from '../../types/location'
import type { WorkbenchEntity, WorkbenchFilters, WorkbenchRecord } from '../../types/transportWorkbench'
import {
  NODE_TYPES, VERIFICATION_OPTIONS, WORKBENCH_ENTITIES, editableRecord,
  relationDocumentId, serializeWorkbenchForm, verificationTone, workbenchErrorMessage,
} from '../../services/transportWorkbench'

const { role } = useAuth()
const toast = useToast()
const workbench = useTransportWorkbench()
const activeEntity = ref<WorkbenchEntity>('transport-nodes')
const filters = reactive<WorkbenchFilters>({ verification: '', planning: '', dataMode: '', route: '', nodeType: '' })
const editing = ref<WorkbenchRecord | null>(null)
const editorOpen = ref(false)
const form = reactive<Record<string, any>>({})
const confirmations = reactive({ coordinate: false, geometry: false, order: false })
const candidateLocation = ref<SelectedLocation | null>(null)
const formError = ref('')
const optionRecords = reactive<Record<string, WorkbenchRecord[]>>({
  'transport-nodes': [], routes: [], 'route-variants': [], 'route-variant-stops': [], 'fare-rules': [], 'service-patterns': [],
})
const isAdministrator = computed(() => role.value === 'Administrator')

const defaults: Record<WorkbenchEntity, Record<string, any>> = {
  'transport-nodes': { name: '', node_code: '', node_type: 'DESIGNATED_STOP', latitude: '', longitude: '', data_mode: 'REAL', verification_status: 'RESEARCH_CANDIDATE', planning_enabled: false, source_name: '', source_reference: '', notes: '' },
  routes: { route_name: '', route_code: '', transport_mode: 'PUJ_TRADITIONAL', origin: '', destination: '', route_status: 'inactive', active: false, data_mode: 'REAL', verification_status: 'RESEARCH_CANDIDATE', planning_enabled: false, source_name: '', source_reference: '', notes: '' },
  'route-variants': { variant_code: '', display_name: '', direction: 'OUTBOUND', route: '', signboard_text: '', start_node: '', end_node: '', operating_status: 'UNKNOWN', geometry_source: 'UNKNOWN', geometry_geojson: '', data_mode: 'REAL', verification_status: 'RESEARCH_CANDIDATE', planning_enabled: false, source_name: '', source_reference: '', notes: '' },
  'route-variant-stops': { route_variant: '', transport_node: '', sequence: 1, pickup_allowed: false, dropoff_allowed: false, transfer_allowed: false, is_timepoint: false, distance_from_variant_start_m: '' },
  'fare-rules': { route: '', route_variant: '', fare_type: 'FLAT', currency: 'PHP', regular_base_fare: '', base_distance_km: '', per_km_after_base: '', minimum_fare: '', effective_from: '', effective_to: '', data_mode: 'REAL', verification_status: 'RESEARCH_CANDIDATE', planning_enabled: false, source_name: '', source_reference: '', notes: '' },
  'service-patterns': { route_variant: '', days_of_week: '', first_trip_time: '', last_trip_time: '', dispatch_type: 'UNKNOWN', headway_min_minutes: '', headway_max_minutes: '', effective_from: '', effective_to: '', data_mode: 'REAL', verification_status: 'RESEARCH_CANDIDATE', planning_enabled: false, source_name: '', source_reference: '', notes: '' },
}

const mapNodes = computed<MapPointFeature[]>(() => {
  if (activeEntity.value !== 'transport-nodes') return []
  const latitude = Number(form.latitude)
  const longitude = Number(form.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (!latitude && !longitude)) return []
  return [{ type: 'Feature', id: 'workbench-node', geometry: { type: 'Point', coordinates: [longitude, latitude] }, properties: {
    semantic: 'stop', label: form.name || 'Candidate transport node', source: 'PAMANA_TRANSPORT_DB',
  } }]
})
const mapLines = computed<MapLineFeature[]>(() => {
  if (activeEntity.value !== 'route-variants' || !form.geometry_geojson) return []
  try {
    const parsed = typeof form.geometry_geojson === 'string' ? JSON.parse(form.geometry_geojson) : form.geometry_geojson
    const geometry = parsed?.type === 'Feature' ? parsed.geometry : parsed
    if (geometry?.type !== 'LineString') return []
    return [{ type: 'Feature', id: 'verified-geometry-preview', geometry, properties: {
      semantic: 'transport-route', label: 'Transit geometry under review', source: 'PAMANA', geometryClassification: 'VERIFIED_TRANSIT_GEOMETRY',
    } }]
  } catch { return [] }
})
const fitKey = computed(() => `${editing.value?.documentId || 'new'}:${form.latitude || ''}:${form.longitude || ''}:${form.geometry_geojson?.length || 0}`)

async function loadOptions() {
  for (const entity of ['transport-nodes', 'routes', 'route-variants'] as WorkbenchEntity[]) {
    const response = await useApi().apiFetch<{ data: WorkbenchRecord[] }>(`/api/transport-workbench/${entity}`)
    optionRecords[entity] = response.data
  }
}
async function load() {
  try { await workbench.list(activeEntity.value, filters) } catch { /* state contains a safe error */ }
}
watch(activeEntity, () => { editing.value = null; editorOpen.value = false; void load() })
watch(filters, () => void load(), { deep: true })
onMounted(async () => { await Promise.all([load(), loadOptions()]) })

function openEditor(record?: WorkbenchRecord) {
  editing.value = record || null
  Object.keys(form).forEach(key => delete form[key])
  Object.assign(form, record ? editableRecord(record) : structuredClone(defaults[activeEntity.value]))
  confirmations.coordinate = false; confirmations.geometry = false; confirmations.order = false
  candidateLocation.value = null; formError.value = ''; editorOpen.value = true
}
function useGeographicEvidence() {
  if (!candidateLocation.value) return
  form.latitude = candidateLocation.value.lat
  form.longitude = candidateLocation.value.lng
  confirmations.coordinate = false
}
async function save() {
  formError.value = ''
  try {
    const payload = serializeWorkbenchForm(activeEntity.value, form)
    await workbench.save(activeEntity.value, payload, {
      documentId: editing.value?.documentId,
      confirmations: { ...confirmations },
    })
    toast.add({ title: 'Transport record saved', description: 'The verified facts and evidence were validated by PAMANA.', color: 'success' })
    editorOpen.value = false
    await Promise.all([load(), loadOptions()])
  } catch (error) { formError.value = workbenchErrorMessage(error) }
}
const labelFor = (value: unknown) => typeof value === 'string' ? value.replaceAll('_', ' ') : 'Not recorded'
const optionLabel = (record: WorkbenchRecord) => `${record.workbench.label}${record.workbench.code ? ` · ${record.workbench.code}` : ''}`
</script>

<template>
  <section class="space-y-5">
    <div class="surface-card p-4 sm:p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span class="pill bg-teal-100 text-teal-800"><UIcon name="i-lucide-shield-check" /> Controlled verification</span>
          <h2 class="mt-3 font-display text-xl font-bold text-neutral-900">Transport data workbench</h2>
          <p class="mt-1 max-w-3xl text-sm leading-6 text-neutral-500">Review real transport facts, evidence, and planning eligibility. Geographic search provides evidence only; a reviewer must explicitly confirm transport coordinates.</p>
        </div>
        <button type="button" class="btn-primary" @click="openEditor()"><UIcon name="i-lucide-plus" /> Add record</button>
      </div>
      <div class="mt-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Transport data type">
        <button v-for="entity in WORKBENCH_ENTITIES" :key="entity.key" type="button" role="tab" :aria-selected="activeEntity === entity.key"
          class="inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition"
          :class="activeEntity === entity.key ? 'border-green-700 bg-green-700 text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'"
          @click="activeEntity = entity.key"><UIcon :name="entity.icon" />{{ entity.label }}</button>
      </div>
    </div>

    <div class="surface-card p-4">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <select v-model="filters.verification" class="wb-input" aria-label="Filter verification"><option value="">All verification</option><option v-for="item in VERIFICATION_OPTIONS" :key="item">{{ item }}</option></select>
        <select v-model="filters.planning" class="wb-input" aria-label="Filter planning"><option value="">All planning states</option><option value="true">Planning enabled</option><option value="false">Planning disabled</option></select>
        <select v-model="filters.dataMode" class="wb-input" aria-label="Filter data mode"><option value="">All data modes</option><option>REAL</option><option>SIMULATED</option></select>
        <select v-if="activeEntity !== 'transport-nodes' && activeEntity !== 'routes'" v-model="filters.route" class="wb-input" aria-label="Filter route"><option value="">All routes</option><option v-for="item in optionRecords.routes" :key="item.documentId" :value="item.documentId">{{ optionLabel(item) }}</option></select>
        <select v-if="activeEntity === 'transport-nodes'" v-model="filters.nodeType" class="wb-input" aria-label="Filter node type"><option value="">All node types</option><option v-for="item in NODE_TYPES" :key="item">{{ item }}</option></select>
      </div>
    </div>

    <div v-if="workbench.error.value" class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{{ workbench.error.value }}</div>
    <div class="surface-card overflow-hidden">
      <div v-if="workbench.loading.value" class="p-8 text-center text-sm text-neutral-500" role="status">Loading transport records…</div>
      <div v-else-if="!workbench.records.value.length" class="p-8 text-center"><UIcon name="i-lucide-database-zap" class="mx-auto size-8 text-neutral-300" /><p class="mt-2 text-sm font-semibold text-neutral-700">No records match these filters.</p></div>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[840px] text-left text-sm">
          <thead class="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500"><tr><th class="px-5 py-3">Name / code</th><th class="px-4 py-3">Trust</th><th class="px-4 py-3">Planning</th><th class="px-4 py-3">Evidence</th><th class="px-4 py-3">Review</th></tr></thead>
          <tbody class="divide-y divide-neutral-100">
            <tr v-for="record in workbench.records.value" :key="record.documentId" class="hover:bg-neutral-50/70">
              <td class="px-5 py-4"><p class="font-semibold text-neutral-900">{{ record.workbench.label }}</p><p class="mt-1 font-mono text-xs text-neutral-400">{{ record.workbench.code }}</p></td>
              <td class="px-4 py-4"><span class="pill" :class="verificationTone(record.verification_status)">{{ labelFor(record.verification_status) }}</span><p class="mt-1 text-[11px] text-neutral-400">{{ record.data_mode || 'Structural record' }}</p></td>
              <td class="px-4 py-4"><span class="pill" :class="record.planning_enabled ? 'bg-blue-100 text-blue-800' : 'bg-neutral-100 text-neutral-500'">{{ activeEntity === 'route-variant-stops' ? 'STRUCTURAL RECORD' : record.planning_enabled ? 'ENABLED' : 'DISABLED' }}</span><p v-if="record.workbench.missingCriticalFields.length" class="mt-2 max-w-48 text-xs text-amber-700">Missing: {{ record.workbench.missingCriticalFields.join(', ') }}</p></td>
              <td class="max-w-xs px-4 py-4 text-xs leading-5 text-neutral-600">{{ record.workbench.evidence }}</td>
              <td class="px-4 py-4"><button type="button" class="btn-soft !px-3 !py-2 text-xs" @click="openEditor(record)"><UIcon name="i-lucide-pencil" /> Review</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <USlideover v-model:open="editorOpen" :ui="{ content: 'max-w-2xl' }">
      <template #content>
        <form class="flex h-full flex-col" @submit.prevent="save">
          <header class="border-b border-neutral-200 p-5"><p class="text-xs font-semibold uppercase tracking-wider text-green-700">{{ editing ? 'Review record' : 'New record' }}</p><h3 class="mt-1 font-display text-xl font-bold text-neutral-900">{{ WORKBENCH_ENTITIES.find(item => item.key === activeEntity)?.label }}</h3></header>
          <div class="flex-1 space-y-5 overflow-y-auto p-5">
            <div v-if="formError" class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{{ formError }}</div>

            <div v-if="activeEntity === 'transport-nodes'" class="grid gap-4 sm:grid-cols-2">
              <label class="wb-label sm:col-span-2">Node name<input v-model="form.name" class="wb-input"></label><label class="wb-label">Node code<input v-model="form.node_code" class="wb-input font-mono"></label>
              <label class="wb-label">Node type<select v-model="form.node_type" class="wb-input"><option v-for="item in NODE_TYPES" :key="item">{{ item }}</option></select></label>
              <label class="wb-label">Latitude<input v-model="form.latitude" inputmode="decimal" class="wb-input"></label><label class="wb-label">Longitude<input v-model="form.longitude" inputmode="decimal" class="wb-input"></label>
              <div class="sm:col-span-2 rounded-2xl border border-teal-200 bg-teal-50 p-4"><p class="text-xs font-semibold uppercase tracking-wide text-teal-800">Map-assisted geographic evidence</p><p class="mt-1 text-xs leading-5 text-teal-700">A place result is not a transport stop. Select a candidate, inspect it, then explicitly confirm the transport-node coordinate.</p><div class="mt-3"><LocationPamanaLocationSearch v-model="candidateLocation" mode="destination" placeholder="Find a nearby geographic place…" /></div><button v-if="candidateLocation" type="button" class="btn-soft mt-3 text-xs" @click="useGeographicEvidence">Use as coordinate candidate</button></div>
              <div class="sm:col-span-2"><PamanaMapPanel provider="maplibre" label="Coordinate verification map" height="280px" :nodes="mapNodes" :fit-key="fitKey" /></div>
              <label class="sm:col-span-2 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800"><input v-model="confirmations.coordinate" type="checkbox" class="mt-1">I inspected the map and confirm these coordinates identify the actual transport pickup, stop, terminal, or drop-off point.</label>
            </div>

            <div v-if="activeEntity === 'routes'" class="grid gap-4 sm:grid-cols-2">
              <label class="wb-label sm:col-span-2">Route name<input v-model="form.route_name" class="wb-input"></label><label class="wb-label">Route code<input v-model="form.route_code" class="wb-input font-mono"></label><label class="wb-label">Transport mode<input v-model="form.transport_mode" class="wb-input"></label>
              <label class="wb-label">Origin semantics<input v-model="form.origin" class="wb-input"></label><label class="wb-label">Destination semantics<input v-model="form.destination" class="wb-input"></label>
              <label class="wb-label">Route status<select v-model="form.route_status" class="wb-input"><option value="active">active</option><option value="inactive">inactive</option></select></label><label class="wb-check"><input v-model="form.active" type="checkbox"> Active service</label>
            </div>

            <div v-if="activeEntity === 'route-variants'" class="grid gap-4 sm:grid-cols-2">
              <label class="wb-label">Variant code<input v-model="form.variant_code" class="wb-input font-mono"></label><label class="wb-label">Display name<input v-model="form.display_name" class="wb-input"></label>
              <label class="wb-label">Route<select v-model="form.route" class="wb-input"><option value="">Select route</option><option v-for="item in optionRecords.routes" :key="item.documentId" :value="item.documentId">{{ optionLabel(item) }}</option></select></label><label class="wb-label">Direction<select v-model="form.direction" class="wb-input"><option>OUTBOUND</option><option>INBOUND</option><option>LOOP</option><option>BIDIRECTIONAL_PATTERN</option></select></label>
              <label class="wb-label sm:col-span-2">Signboard text<input v-model="form.signboard_text" class="wb-input"></label>
              <label class="wb-label">Start node<select v-model="form.start_node" class="wb-input"><option value="">Unknown</option><option v-for="item in optionRecords['transport-nodes']" :key="item.documentId" :value="item.documentId">{{ optionLabel(item) }}</option></select></label><label class="wb-label">End node<select v-model="form.end_node" class="wb-input"><option value="">Unknown</option><option v-for="item in optionRecords['transport-nodes']" :key="item.documentId" :value="item.documentId">{{ optionLabel(item) }}</option></select></label>
              <label class="wb-label">Operating status<select v-model="form.operating_status" class="wb-input"><option>ACTIVE</option><option>LIMITED</option><option>SUSPENDED</option><option>INACTIVE</option><option>UNKNOWN</option></select></label><label class="wb-label">Geometry source<select v-model="form.geometry_source" class="wb-input"><option>UNKNOWN</option><option>FIELD_GPS</option><option>AUTHORITATIVE</option><option>MANUAL_VERIFIED</option></select></label>
              <label class="wb-label">Effective from<input v-model="form.effective_from" type="date" class="wb-input"></label><label class="wb-label">Effective to<input v-model="form.effective_to" type="date" class="wb-input"></label>
              <label class="wb-label sm:col-span-2">Verified GeoJSON geometry<textarea v-model="form.geometry_geojson" rows="8" class="wb-input font-mono text-xs" placeholder='{"type":"LineString","coordinates":[[120.6,15.0],[120.7,15.1]]}' /></label>
              <div v-if="mapLines.length" class="sm:col-span-2"><PamanaMapPanel provider="maplibre" label="Geometry verification map" height="280px" :lines="mapLines" :fit-key="fitKey" /></div>
              <label class="sm:col-span-2 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800"><input v-model="confirmations.geometry" type="checkbox" class="mt-1">I inspected this GeoJSON and confirm it is verified public-transport geometry. A Geoapify road path cannot be confirmed here as transit truth.</label>
            </div>

            <div v-if="activeEntity === 'route-variant-stops'" class="grid gap-4 sm:grid-cols-2">
              <label class="wb-label sm:col-span-2">Route variant<select v-model="form.route_variant" class="wb-input"><option value="">Select variant</option><option v-for="item in optionRecords['route-variants']" :key="item.documentId" :value="item.documentId">{{ optionLabel(item) }}</option></select></label>
              <label class="wb-label sm:col-span-2">Transport node<select v-model="form.transport_node" class="wb-input"><option value="">Select node</option><option v-for="item in optionRecords['transport-nodes']" :key="item.documentId" :value="item.documentId">{{ optionLabel(item) }}</option></select></label>
              <label class="wb-label">Sequence<input v-model="form.sequence" type="number" min="1" class="wb-input"></label><label class="wb-label">Distance from start (m)<input v-model="form.distance_from_variant_start_m" type="number" min="0" class="wb-input"></label>
              <label class="wb-check"><input v-model="form.pickup_allowed" type="checkbox"> Pickup allowed</label><label class="wb-check"><input v-model="form.dropoff_allowed" type="checkbox"> Drop-off allowed</label><label class="wb-check"><input v-model="form.transfer_allowed" type="checkbox"> Transfer allowed</label><label class="wb-check"><input v-model="form.is_timepoint" type="checkbox"> Timepoint</label>
              <label v-if="editing" class="sm:col-span-2 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><input v-model="confirmations.order" type="checkbox">I confirm this sequence change intentionally reorders the variant.</label>
            </div>

            <div v-if="activeEntity === 'fare-rules'" class="grid gap-4 sm:grid-cols-2">
              <label class="wb-label">Route<select v-model="form.route" class="wb-input"><option value="">Any / variant scope</option><option v-for="item in optionRecords.routes" :key="item.documentId" :value="item.documentId">{{ optionLabel(item) }}</option></select></label><label class="wb-label">Route variant<select v-model="form.route_variant" class="wb-input"><option value="">Any / route scope</option><option v-for="item in optionRecords['route-variants']" :key="item.documentId" :value="item.documentId">{{ optionLabel(item) }}</option></select></label>
              <label class="wb-label">Fare type<select v-model="form.fare_type" class="wb-input"><option>FLAT</option><option>DISTANCE_BASED</option><option>ZONE</option><option>MANUAL_LOOKUP</option></select></label><label class="wb-label">Currency<input v-model="form.currency" maxlength="3" class="wb-input"></label>
              <label class="wb-label">Regular/base fare<input v-model="form.regular_base_fare" inputmode="decimal" class="wb-input"></label><label class="wb-label">Minimum fare<input v-model="form.minimum_fare" inputmode="decimal" class="wb-input"></label>
              <label v-if="form.fare_type === 'DISTANCE_BASED'" class="wb-label">Base distance (km)<input v-model="form.base_distance_km" inputmode="decimal" class="wb-input"></label><label v-if="form.fare_type === 'DISTANCE_BASED'" class="wb-label">Per km after base<input v-model="form.per_km_after_base" inputmode="decimal" class="wb-input"></label>
              <label class="wb-label">Effective from<input v-model="form.effective_from" type="date" class="wb-input"></label><label class="wb-label">Effective to<input v-model="form.effective_to" type="date" class="wb-input"></label>
            </div>

            <div v-if="activeEntity === 'service-patterns'" class="grid gap-4 sm:grid-cols-2">
              <label class="wb-label sm:col-span-2">Route variant<select v-model="form.route_variant" class="wb-input"><option value="">Select variant</option><option v-for="item in optionRecords['route-variants']" :key="item.documentId" :value="item.documentId">{{ optionLabel(item) }}</option></select></label>
              <label class="wb-label sm:col-span-2">Service days (comma separated)<input v-model="form.days_of_week" class="wb-input" placeholder="MONDAY, TUESDAY, WEDNESDAY"></label>
              <label class="wb-label">Dispatch type<select v-model="form.dispatch_type" class="wb-input"><option>SCHEDULED</option><option>HEADWAY</option><option>LEAVE_WHEN_FULL</option><option>CONTINUOUS_UNSCHEDULED</option><option>UNKNOWN</option></select></label><span />
              <label class="wb-label">First trip<input v-model="form.first_trip_time" type="time" class="wb-input"></label><label class="wb-label">Last trip<input v-model="form.last_trip_time" type="time" class="wb-input"></label>
              <label v-if="['SCHEDULED','HEADWAY'].includes(form.dispatch_type)" class="wb-label">Minimum headway<input v-model="form.headway_min_minutes" type="number" min="1" class="wb-input"></label><label v-if="['SCHEDULED','HEADWAY'].includes(form.dispatch_type)" class="wb-label">Maximum headway<input v-model="form.headway_max_minutes" type="number" min="1" class="wb-input"></label>
              <label class="wb-label">Effective from<input v-model="form.effective_from" type="date" class="wb-input"></label><label class="wb-label">Effective to<input v-model="form.effective_to" type="date" class="wb-input"></label>
            </div>

            <div v-if="activeEntity !== 'route-variant-stops'" class="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <h4 class="text-sm font-bold text-neutral-800">Evidence and trust</h4>
              <div class="grid gap-4 sm:grid-cols-2"><label class="wb-label">Source name<input v-model="form.source_name" class="wb-input"></label><label class="wb-label">Reference<input v-model="form.source_reference" class="wb-input"></label><label class="wb-label">Verification<select v-model="form.verification_status" class="wb-input" :disabled="!isAdministrator"><option v-for="item in VERIFICATION_OPTIONS" :key="item">{{ item }}</option></select></label><label class="wb-label">Verified at<input v-model="form.verified_at" type="datetime-local" class="wb-input" :disabled="!isAdministrator"></label><label class="wb-label">Data mode<select v-model="form.data_mode" class="wb-input"><option>REAL</option><option>SIMULATED</option></select></label><label class="wb-check"><input v-model="form.planning_enabled" type="checkbox" :disabled="!isAdministrator"> Planning enabled</label></div>
              <label class="wb-label">Reviewer notes<textarea v-model="form.notes" rows="3" class="wb-input" /></label>
              <p v-if="!isAdministrator" class="text-xs text-amber-700">LGU reviewers may maintain facts and evidence. Only an Administrator can elevate verification or enable planning.</p>
            </div>
          </div>
          <footer class="flex items-center justify-end gap-3 border-t border-neutral-200 p-4"><button type="button" class="btn-soft" @click="editorOpen = false">Cancel</button><button type="submit" class="btn-primary" :disabled="workbench.saving.value"><UIcon :name="workbench.saving.value ? 'i-lucide-loader-circle' : 'i-lucide-save'" :class="{ 'animate-spin': workbench.saving.value }" />{{ workbench.saving.value ? 'Validating…' : 'Save reviewed record' }}</button></footer>
        </form>
      </template>
    </USlideover>
  </section>
</template>

<style scoped>
.wb-label { display: grid; gap: .4rem; color: #525252; font-size: .75rem; font-weight: 650; }
.wb-input { min-height: 2.75rem; width: 100%; border: 1px solid #e5e7eb; border-radius: .75rem; background: #fff; padding: .65rem .8rem; color: #171717; font-size: .875rem; outline: none; }
.wb-input:focus { border-color: #65a30d; box-shadow: 0 0 0 3px rgb(132 204 22 / 14%); }
.wb-input:disabled { cursor: not-allowed; background: #f5f5f5; color: #737373; }
.wb-check { display: flex; min-height: 2.75rem; align-items: center; gap: .65rem; border: 1px solid #e5e7eb; border-radius: .75rem; background: #fff; padding: .65rem .8rem; color: #404040; font-size: .8rem; font-weight: 600; }
</style>
