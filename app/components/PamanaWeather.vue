<script setup lang="ts">
import type { WeatherPoint } from '../types/weather'
import { weatherCondition } from '../services/weatherPresentation'
const props = defineProps<{ location?: WeatherPoint | null }>()
const weather = useCurrentWeather(computed(() => props.location ?? null))
const condition = computed(() => weatherCondition(weather.current.value?.weatherCode ?? null))
const asOf = computed(() => weather.current.value?.asOf ? new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit',
}).format(new Date(weather.current.value.asOf)) : '')
</script>

<template>
  <section class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-neutral-200 bg-white/80 px-4 py-3 text-sm" aria-label="Current weather" aria-live="polite" :aria-busy="weather.loading.value">
    <UIcon :name="condition.icon" class="size-5 shrink-0 text-lime-700" />
    <div class="min-w-0 flex-1">
      <p class="truncate text-xs font-medium text-neutral-500">Weather near {{ location?.label || 'San Juan, Mexico, Pampanga' }}</p>
      <p v-if="weather.current.value" class="font-semibold text-neutral-900">{{ Math.round(weather.current.value.temperatureC!) }}°C · {{ condition.label }}</p>
      <p v-else class="text-neutral-600">{{ weather.loading.value ? 'Checking current weather…' : 'Current weather unavailable' }}</p>
    </div>
    <div v-if="weather.current.value" class="text-xs text-neutral-600">
      <p>Rain {{ weather.current.value.precipitationMm }} mm · Wind {{ Math.round(weather.current.value.windKmh!) }} km/h</p>
      <p class="mt-0.5"><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" class="underline">Open-Meteo</a> model estimate · {{ asOf }} PHT</p>
    </div>
    <button v-else-if="!weather.loading.value" type="button" class="min-h-10 rounded-xl px-3 text-xs font-semibold text-lime-800 hover:bg-lime-50" @click="weather.refresh">Retry</button>
  </section>
</template>
