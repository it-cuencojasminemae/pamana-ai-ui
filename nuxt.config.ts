// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      //@ts-ignore
      apiUrl: process.env.NUXT_PUBLIC_API_URL || 'http://localhost:1337',
      // This contains no secret. Keep the prototype honest by default until
      // verified route, vehicle, and prediction data are available.
      demoMode: process.env.NUXT_PUBLIC_DEMO_MODE || 'true',
      // Display opt-in only. The backend's PAMANA_DEMO_MODE_ENABLED gate is
      // authoritative and cannot be enabled by browser input.
      pamanaDemoModeEnabled: process.env.NUXT_PUBLIC_PAMANA_DEMO_MODE_ENABLED || 'false',
      // CARTO's browser tile key is intentionally public. Leave it empty to
      // retain the OpenStreetMap fallback rather than embedding a key in Vue.
      cartoBasemapKey: process.env.NUXT_PUBLIC_CARTO_BASEMAP_KEY || '',
      // Browser-visible Geoapify key: restrict origins/referrers in the provider console.
      geoapifyApiKey: '',
      // Optional Geoapify style identifier (not a URL containing a key).
      geoapifyMapStyle: ''
    }
  }
})
