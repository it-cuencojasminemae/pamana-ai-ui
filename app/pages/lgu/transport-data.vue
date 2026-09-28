<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: ['auth', 'lgu'] })
</script>

<template>
  <div class="space-y-6">
    <PamanaPageHeader title="Transport Data Verification" role="lgu" />
    <PamanaTransportWorkbench />
  </div>
</template>
