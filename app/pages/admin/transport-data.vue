<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] })
</script>

<template>
  <div class="space-y-6">
    <PamanaPageHeader title="Transport Data Verification" role="admin" />
    <PamanaTransportWorkbench />
  </div>
</template>
