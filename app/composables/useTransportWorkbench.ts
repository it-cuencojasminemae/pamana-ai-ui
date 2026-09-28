import type { WorkbenchConfirmations, WorkbenchEntity, WorkbenchFilters, WorkbenchRecord } from '../types/transportWorkbench'

export function useTransportWorkbench() {
  const { apiFetch } = useApi()
  const records = ref<WorkbenchRecord[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function list(entity: WorkbenchEntity, filters: WorkbenchFilters = {}) {
    loading.value = true
    error.value = null
    try {
      const response = await apiFetch<{ data: WorkbenchRecord[] }>(`/api/transport-workbench/${entity}`, {
        query: Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value != null)),
      })
      records.value = response.data
      return response.data
    } catch (cause: any) {
      error.value = cause?.response?.status === 403
        ? 'Your account is not authorized to use the transport-data workbench.'
        : 'Transport data is temporarily unavailable.'
      throw cause
    } finally {
      loading.value = false
    }
  }

  async function save(entity: WorkbenchEntity, data: Record<string, unknown>, options: {
    documentId?: string; confirmations?: WorkbenchConfirmations
  } = {}) {
    saving.value = true
    try {
      const response = await apiFetch<{ data: WorkbenchRecord }>(
        `/api/transport-workbench/${entity}${options.documentId ? `/${options.documentId}` : ''}`,
        { method: options.documentId ? 'PUT' : 'POST', body: { data, confirmations: options.confirmations || {} } },
      )
      return response.data
    } finally {
      saving.value = false
    }
  }

  return { error, list, loading, records, save, saving }
}
