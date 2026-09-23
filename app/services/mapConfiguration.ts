export interface GeographicConfig {
  geoapifyApiKey?: unknown
  geoapifyMapStyle?: unknown
}

export type ConfigurationError = 'MISSING_API_KEY' | 'INVALID_CONFIGURATION'
export type MapConfiguration =
  | { ok: true; apiKey: string; styleId: string; styleUrl: string }
  | { ok: false; error: ConfigurationError }

/** Geoapify style identifiers only: never send a browser key to arbitrary hosts. */
export function resolveMapConfiguration(config: GeographicConfig): MapConfiguration {
  const key = config.geoapifyApiKey
  if (key === undefined || key === null || key === '') return { ok: false, error: 'MISSING_API_KEY' }
  if (typeof key !== 'string' || !key.trim()) return { ok: false, error: 'INVALID_CONFIGURATION' }
  const apiKey = key.trim()
  if (!/^[A-Za-z0-9_-]+$/.test(apiKey) || /^(YOUR_|REPLACE_|placeholder)/i.test(apiKey)) {
    return { ok: false, error: 'INVALID_CONFIGURATION' }
  }
  const rawStyle = config.geoapifyMapStyle ?? ''
  if (typeof rawStyle !== 'string') return { ok: false, error: 'INVALID_CONFIGURATION' }
  const styleId = rawStyle.trim() || 'osm-carto'
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(styleId)) return { ok: false, error: 'INVALID_CONFIGURATION' }
  return { ok: true, apiKey, styleId, styleUrl: `https://maps.geoapify.com/v1/styles/${styleId}/style.json?apiKey=${encodeURIComponent(apiKey)}` }
}
