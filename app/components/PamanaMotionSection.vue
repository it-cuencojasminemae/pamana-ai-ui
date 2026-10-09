<script setup lang="ts">
import type { RevealPreset } from '../services/uiMotion'

withDefaults(defineProps<{ preset?: RevealPreset; delay?: number }>(), {
  preset: 'rise',
  delay: 0,
})
</script>

<template>
  <section v-pamana-reveal="{ preset, delay }">
    <slot />
  </section>
</template>
