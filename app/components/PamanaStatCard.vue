<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  value: string | number
  icon?: string
  tone?: 'neutral' | 'lime' | 'teal' | 'amber' | 'red'
}>(), {
  tone: 'neutral'
})

const toneClasses = {
  neutral: 'text-neutral-900',
  lime: 'text-lime-700',
  teal: 'text-teal-700',
  amber: 'text-amber-700',
  red: 'text-red-600'
}
</script>

<template>
  <div v-pamana-reveal class="glass card-lift rounded-[24px] border border-neutral-900/5 p-4 shadow-[0_18px_42px_-28px_rgba(15,23,42,0.28)] sm:p-5">
    <p class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
      <UIcon v-if="icon" :name="icon" class="size-3.5" />
      {{ label }}
    </p>
    <p class="stat-num mt-3 text-3xl leading-none" :class="toneClasses[tone]">
      {{ value }}
    </p>
  </div>
</template>
