import { z } from 'zod'
import type { PlanningMode } from '../types/tripPlan'
import type { PilotLandmark } from '../types/pilotLandmarks'

const capabilitiesSchema = z.object({ operational: z.literal(true), researchPreview: z.boolean(), simulatedObservations: z.boolean(),
  accessPolicy: z.object({ preferredWalkMeters: z.number().positive(), maximumWalkMeters: z.number().positive(), candidateRadiusMeters: z.number().positive() }),
  referenceLocations: z.array(z.object({ id: z.string().startsWith('research-reference-'), name: z.string().min(1).max(200),
    lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180), category: z.literal('SERVICE'),
    aliases: z.array(z.string()), nodeType: z.string(), evidenceClass: z.literal('USER_REPORTED') })).max(50) })

export function usePlanningCapabilities() {
  const { apiFetch } = useApi()
  const capability = useState<z.infer<typeof capabilitiesSchema> | null>('planning-capabilities', () => null)
  const mode = useState<PlanningMode>('passenger-planning-mode', () => 'OPERATIONAL')
  const error = ref('')
  let controller: AbortController | null = null
  let generation = 0
  async function load() {
    controller?.abort()
    const active = new AbortController()
    controller = active
    const current = ++generation
    try {
      const checked = capabilitiesSchema.safeParse(await apiFetch('/api/pamana-ai/planning-capabilities', { timeout: 7000, signal: active.signal }))
      if (current !== generation || active.signal.aborted) return
      if (!checked.success) throw new Error('Invalid capabilities')
      capability.value = checked.data
      error.value = ''
    } catch {
      if (current !== generation || active.signal.aborted) return
      capability.value = null; error.value = 'Additional planning options are unavailable. Standard planning remains available.'
    }
    restore()
  }
  // Simplified passenger UI uses server-authorized capabilities, never URL choices.
  function restore(_value?: unknown) { mode.value = capability.value?.researchPreview ? 'RESEARCH_PREVIEW' : 'OPERATIONAL' }
  onBeforeUnmount(() => { generation++; controller?.abort() })
  const referenceLocations = computed<PilotLandmark[]>(() => mode.value === 'RESEARCH_PREVIEW' && capability.value?.researchPreview ? capability.value.referenceLocations : [])
  return { capability, mode, error, load, restore, referenceLocations, available: computed(() => capability.value?.researchPreview === true) }
}
