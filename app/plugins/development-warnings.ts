// Vue's default development trace can serialize reactive application state.
// Keep useful warning categories without logging component props or auth state.
export default defineNuxtPlugin((app) => {
  if (!import.meta.dev) return
  app.vueApp.config.warnHandler = (message) => {
    const category = /Failed to resolve component/i.test(message) ? 'Component resolution failed'
      : /Hydration/i.test(message) ? 'Hydration warning'
        : /Invalid prop/i.test(message) ? 'Component prop validation failed'
          : 'Component warning'
    console.warn(`[Vue warn]: ${category}; inspect the component without logging application state.`)
  }
})
