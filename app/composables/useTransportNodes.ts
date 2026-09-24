import type { MapTransportNode, TransportNodeDiagnostics } from '../types/transportNode.ts'
import { fetchPassengerTransportNodes } from '../services/transportNodes.ts'

export function useTransportNodes() {
  const { apiFetch } = useApi()
  const nodes = ref<MapTransportNode[]>([])
  const diagnostics = ref<TransportNodeDiagnostics>({ received: 0, visible: 0, unmapped: 0, ineligible: 0, malformed: 0 })
  const status = ref<'idle' | 'loading' | 'ready' | 'unauthorized' | 'error'>('idle')
  const abort = shallowRef<AbortController | null>(null)

  async function load() {
    abort.value?.abort()
    const controller = new AbortController()
    abort.value = controller
    status.value = 'loading'
    const result = await fetchPassengerTransportNodes(apiFetch, controller.signal)
    if (controller.signal.aborted || abort.value !== controller) return
    if (!result.ok) { nodes.value = []; status.value = result.error === 'UNAUTHORIZED' ? 'unauthorized' : 'error'; return }
    nodes.value = result.nodes
    diagnostics.value = result.diagnostics
    status.value = 'ready'
  }

  onBeforeUnmount(() => abort.value?.abort())
  return { nodes, diagnostics, status, load }
}
