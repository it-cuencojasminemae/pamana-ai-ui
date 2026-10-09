<script setup lang="ts">
definePageMeta({
  middleware: ['auth', 'driver']
})

useHead({
  title: 'Demand Map | PAMANA'
})
</script>

<template>
  <div>
    <PamanaPageHeader title="Demand Map" role="driver" />

    <div class="grid gap-5 lg:grid-cols-3">
      <PamanaMapPanel
        provider="maplibre"
        compact
        class="lg:col-span-2"
        icon="i-lucide-map-pinned"
        label="Predicted passenger demand by stop"
        height="420px"
        tone="emerald"
      />

      <UCard v-pamana-reveal class="glass rounded-30" :ui="{ root: 'ring-0 rounded-30' }">
        <h2 class="font-display text-sm font-semibold text-neutral-900">Predicted waiting passengers</h2>
        <div class="mt-5 rounded-2xl border border-neutral-200/70 bg-white/60 px-5 py-8 text-center" role="status">
          <span class="mx-auto flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <UIcon name="i-lucide-users" class="size-5" aria-hidden="true" />
          </span>
          <p class="mt-3 text-sm font-medium text-neutral-800">No demand data available</p>
          <p class="mt-2 text-xs leading-relaxed text-neutral-500">
            Passenger estimates will appear here when demand data is available.
          </p>
        </div>
      </UCard>
    </div>
  </div>
</template>
