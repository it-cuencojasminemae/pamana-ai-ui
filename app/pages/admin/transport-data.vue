<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] })
useHead({ title: 'Transport Data Verification | PAMANA' })
</script>

<template>
  <div class="space-y-6">
    <PamanaPageHeader title="Transport Data Verification" role="admin" />
    <TransportDataPamanaTransportWorkbench />
  </div>
</template>
