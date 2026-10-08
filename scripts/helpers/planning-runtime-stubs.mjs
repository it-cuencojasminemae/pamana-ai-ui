import * as Vue from 'vue'
// Legacy operational UI harnesses supply unavailable research capabilities.
// Research mode, capability authorization and detail races have separate tests.
export function planningRuntimeStubs() {
  const mode = Vue.ref('OPERATIONAL')
  return {
    usePlanningCapabilities: () => ({ mode, referenceLocations: Vue.ref([]), capability: Vue.ref(null), available: Vue.ref(false), load: async () => {}, restore: () => { mode.value = 'OPERATIONAL' } }),
    useJourneyDetails: () => ({ notice: Vue.ref(''), reset() {}, load: async () => {} }),
    researchReferenceFeatures: () => [],
  }
}
