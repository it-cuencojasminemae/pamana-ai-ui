<template>
  <MotionConfig reduced-motion="user" :transition="{ duration: 0.3, ease: 'easeOut' }">
    <UApp>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UApp>
  </MotionConfig>
</template>
