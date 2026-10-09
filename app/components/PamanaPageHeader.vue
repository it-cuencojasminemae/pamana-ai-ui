<script setup lang="ts">
type PamanaRole = 'passenger' | 'driver' | 'lgu' | 'admin'

const props = defineProps<{
  title: string
  role: PamanaRole
  subtitle?: string
}>()

const roleMeta = computed(() => ({
  passenger: {
    label: 'Passenger page',
    icon: 'i-lucide-user-round',
    classes: 'bg-lime-100 text-lime-700 ring-1 ring-lime-300/50'
  },
  driver: {
    label: 'Driver page',
    icon: 'i-lucide-bus-front',
    classes: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300/40'
  },
  lgu: {
    label: 'LGU page',
    icon: 'i-lucide-landmark',
    classes: 'bg-teal-100 text-teal-700 ring-1 ring-teal-300/40'
  },
  admin: {
    label: 'Administrator page',
    icon: 'i-lucide-shield',
    classes: 'bg-green-100 text-green-800 ring-1 ring-green-300/40'
  }
})[props.role])
</script>

<template>
  <div v-pamana-reveal class="mb-6 rounded-[28px] border border-neutral-900/6 bg-white/70 p-4 shadow-[0_22px_50px_-28px_rgba(15,23,42,0.25)] backdrop-blur-xl sm:p-5">
    <div class="flex flex-wrap items-center gap-2 sm:gap-3">
      <span class="pill normal-case shadow-sm" :class="roleMeta.classes">
        <UIcon :name="roleMeta.icon" class="size-3.5" />
        {{ roleMeta.label }}
      </span>

      <h1 class="font-display text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
        {{ title }}
      </h1>

      <div v-if="$slots.actions" class="w-full sm:ml-auto sm:w-auto">
        <slot name="actions" />
      </div>
    </div>

    <p v-if="subtitle" class="mt-3 text-sm text-neutral-600 sm:text-[15px]">
      {{ subtitle }}
    </p>
  </div>
</template>
