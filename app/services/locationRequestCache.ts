import type { LocationResult } from './geoapify.ts'

/** Bounded geography reuse. Each subscriber owns its cancellation independently. */
export function createLocationRequestCache({ ttlMs = 300_000, maxEntries = 50, now = Date.now } = {}) {
  const completed = new Map<string, { expiresAt: number; result: LocationResult }>()
  const pending = new Map<string, { controller: AbortController; subscribers: number; promise: Promise<LocationResult> }>()
  const cancelled = (): LocationResult => ({ ok: false, error: 'ABORTED' })

  async function resolve(key: string, operation: (signal: AbortSignal) => Promise<LocationResult>, signal?: AbortSignal): Promise<LocationResult> {
    if (signal?.aborted) return cancelled()
    const cached = completed.get(key)
    if (cached && cached.expiresAt > now()) return structuredClone(cached.result)
    if (cached) completed.delete(key)
    let entry = pending.get(key)
    if (entry?.controller.signal.aborted) entry = undefined
    if (!entry) {
      if (pending.size >= maxEntries) return { ok: false, error: 'RATE_LIMITED' }
      const controller = new AbortController()
      const current = { controller, subscribers: 0, promise: null as unknown as Promise<LocationResult> }
      pending.set(key, current)
      current.promise = Promise.resolve().then(() => operation(controller.signal))
        .catch((): LocationResult => ({ ok: false, error: 'NETWORK_ERROR' }))
        .then(result => {
          if (result.ok && !controller.signal.aborted) {
            completed.set(key, { expiresAt: now() + ttlMs, result: structuredClone(result) })
            while (completed.size > maxEntries) completed.delete(completed.keys().next().value!)
          }
          return result
        })
        .finally(() => { if (pending.get(key) === current) pending.delete(key) })
      entry = current
    }
    const current = entry
    current.subscribers++
    return new Promise(resolve => {
      let settled = false
      const finish = (result: LocationResult) => {
        if (settled) return
        settled = true
        signal?.removeEventListener('abort', cancel)
        current.subscribers--
        if (!current.subscribers) current.controller.abort()
        resolve(structuredClone(result))
      }
      const cancel = () => finish(cancelled())
      signal?.addEventListener('abort', cancel, { once: true })
      if (signal?.aborted) cancel()
      current.promise.then(finish)
    })
  }
  return { resolve }
}
