import { createGeoapifyClient } from '../services/geoapify.ts'
const clients = new WeakMap<object, ReturnType<typeof createGeoapifyClient>>()

export function useGeoapify() {
  const config = useRuntimeConfig()
  const app = useNuxtApp()
  // No request on construction. Callers own AbortControllers and cancel on disposal.
  let client = clients.get(app)
  if (!client) {
    client = createGeoapifyClient(() => config.public)
    clients.set(app, client)
  }
  return client
}
