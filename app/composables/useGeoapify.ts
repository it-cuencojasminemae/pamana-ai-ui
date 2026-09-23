import { createGeoapifyClient } from '../services/geoapify.ts'

export function useGeoapify() {
  const config = useRuntimeConfig()
  // No request on construction. Callers own AbortControllers and cancel on disposal.
  return createGeoapifyClient(() => config.public)
}
