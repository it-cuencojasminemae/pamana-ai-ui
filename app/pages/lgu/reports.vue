<script setup lang="ts">
import { formatReportTitle } from '~/services/reportPresentation'

definePageMeta({ middleware: ['auth', 'lgu'] })
useHead({ title: 'Passenger Reports | PAMANA' })

const { apiFetch } = useApi()
const toast = useToast()
interface Relation { route_code?: string; variant_code?: string; display_name?: string; node_code?: string; name?: string; vehicle_number?: string }
interface ReviewReport {
  documentId: string; report_type: string; description?: string | null; location_note?: string | null
  latitude?: number | null; longitude?: number | null; location_accuracy_m?: number | null
  reported_at?: string; review_status?: string; review_notes?: string | null
  route?: Relation | null; route_variant?: Relation | null; transport_node?: Relation | null; vehicle?: Relation | null
}
const reports = ref<ReviewReport[]>([])
const loading = ref(true)
const savingId = ref<string | null>(null)
const statusFilter = ref('ALL')
const reviewStatus = reactive<Record<string, string>>({})
const reviewNotes = reactive<Record<string, string>>({})
const statuses = ['PENDING', 'REVIEWED', 'VERIFIED', 'DISMISSED']
const filteredReports = computed(() => statusFilter.value === 'ALL' ? reports.value : reports.value.filter(report => (report.review_status || 'PENDING') === statusFilter.value))

const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^./, char => char.toUpperCase())
const contextLabel = (report: ReviewReport) => [
  report.route_variant?.display_name || report.route_variant?.variant_code || report.route?.route_code,
  report.transport_node?.name || report.transport_node?.node_code,
  report.vehicle?.vehicle_number,
].filter(Boolean).join(' · ') || 'No transport record attached'

async function loadReports() {
  loading.value = true
  try {
    const response = await apiFetch<{ data: ReviewReport[] }>('/api/passenger-reports', { query: { sort: 'reported_at:desc', 'pagination[pageSize]': 100 } })
    reports.value = response.data || []
    for (const report of reports.value) {
      reviewStatus[report.documentId] = report.review_status === 'PENDING' ? 'REVIEWED' : report.review_status || 'REVIEWED'
      reviewNotes[report.documentId] = report.review_notes || ''
    }
  } catch {
    reports.value = []
    toast.add({ title: 'Unable to load reports', description: 'Check your review permissions and try again.', color: 'error' })
  } finally { loading.value = false }
}

async function saveReview(report: ReviewReport) {
  const notes = (reviewNotes[report.documentId] || '').trim()
  if (notes.length < 3) {
    toast.add({ title: 'Add review notes', description: 'Record at least three characters explaining the review decision.', color: 'warning' })
    return
  }
  savingId.value = report.documentId
  try {
    await apiFetch(`/api/passenger-reports/${report.documentId}`, {
      method: 'PUT', body: { data: { review_status: reviewStatus[report.documentId], review_notes: notes } },
    })
    toast.add({ title: 'Review saved', description: 'Only the report status changed. Transport truth was not modified.', color: 'success' })
    await loadReports()
  } catch (error: any) {
    toast.add({ title: 'Unable to save review', description: error?.data?.error?.message || 'Please try again.', color: 'error' })
  } finally { savingId.value = null }
}

onMounted(loadReports)
</script>

<template>
  <div>
    <PamanaPageHeader title="Passenger Reports" role="lgu" />
    <UAlert color="warning" variant="soft" icon="i-lucide-shield-alert" title="Evidence review queue" description="VERIFIED means the observation was reviewed. It does not verify a route, node, fare, service pattern, disruption, or vehicle occupancy." class="mb-5 rounded-2xl" />
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-neutral-600">Reporter identities are withheld. Exact locations are visible only in this authorized review workspace.</p>
      <select v-model="statusFilter" class="min-h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" aria-label="Filter report status"><option value="ALL">All statuses</option><option v-for="status in statuses" :key="status" :value="status">{{ label(status) }}</option></select>
    </div>
    <div class="grid gap-4 lg:grid-cols-2">
      <UCard v-if="loading" class="glass rounded-30 animate-pulse" :ui="{ root: 'ring-0 rounded-30' }"><div class="h-32" /></UCard>
      <UCard v-pamana-reveal v-else-if="!filteredReports.length" class="glass rounded-30 lg:col-span-2" :ui="{ root: 'ring-0 rounded-30' }"><p class="py-8 text-center text-sm text-neutral-500">No passenger reports match this filter.</p></UCard>
      <UCard v-pamana-reveal v-for="report in filteredReports" :key="report.documentId" class="glass rounded-30" :ui="{ root: 'ring-0 rounded-30' }">
        <div class="flex flex-wrap items-center gap-2"><h2 class="text-sm font-semibold text-neutral-900">{{ formatReportTitle(report.report_type) }}</h2><span class="pill bg-amber-100 text-amber-800">{{ label(report.review_status || 'PENDING') }}</span></div>
        <p class="mt-2 text-sm text-neutral-700">{{ report.description || report.location_note || 'Legacy passenger observation' }}</p>
        <p class="mt-2 text-xs text-neutral-500">{{ contextLabel(report) }}</p>
        <p v-if="report.location_note" class="mt-1 text-xs text-neutral-500">Location note: {{ report.location_note }}</p>
        <p v-if="Number.isFinite(Number(report.latitude)) && Number.isFinite(Number(report.longitude))" class="mt-1 text-xs text-neutral-500">Private GPS evidence attached · accuracy {{ report.location_accuracy_m == null ? 'unknown' : `${Math.round(report.location_accuracy_m)} m` }}</p>
        <div class="mt-4 grid gap-2 sm:grid-cols-[150px_1fr]">
          <select v-model="reviewStatus[report.documentId]" class="min-h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" :aria-label="`Review status for ${label(report.report_type)}`"><option value="REVIEWED">Reviewed</option><option value="VERIFIED">Report verified</option><option value="DISMISSED">Dismissed</option></select>
          <input v-model="reviewNotes[report.documentId]" maxlength="1000" class="min-h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" placeholder="Review notes">
        </div>
        <div class="mt-3 flex justify-end"><UButton data-pamana-feedback size="sm" icon="i-lucide-check" class="rounded-full" :loading="savingId === report.documentId" @click="saveReview(report)">Save review</UButton></div>
      </UCard>
    </div>
  </div>
</template>
