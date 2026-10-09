<script setup lang="ts">
// @ts-nocheck

const {
  user,
  role,
  logout,
  isPassenger,
  isDriver,
  isLGU,
  isAdministrator
} = useAuth()

const route = useRoute()
const toast = useToast()

const isSidebarOpen = ref(false)
const loggingOut = ref(false)
const hydrated = ref(false)

onMounted(() => {
  hydrated.value = true
})

const visibleUser = computed(() => hydrated.value ? user.value : null)
const visibleRole = computed(() => hydrated.value ? role.value : null)
const visibleIsPassenger = computed(() => hydrated.value && isPassenger.value)
const visibleIsDriver = computed(() => hydrated.value && isDriver.value)
const visibleIsLGU = computed(() => hydrated.value && isLGU.value)
const visibleIsAdministrator = computed(() => hydrated.value && isAdministrator.value)

const navigationItems = computed(() => {
  if (visibleIsPassenger.value) {
    return [
      {
        label: 'Dashboard',
        icon: 'i-lucide-layout-dashboard',
        to: '/passenger'
      },
      {
        label: 'Trip Planner',
        icon: 'i-lucide-route',
        to: '/passenger/trip-planner'
      },
      {
        label: 'Live Map',
        icon: 'i-lucide-map',
        to: '/passenger/map'
      },
      {
        label: 'My Reports',
        icon: 'i-lucide-message-square-warning',
        to: '/passenger/reports'
      }
    ]
  }

  if (visibleIsDriver.value) {
    return [
      {
        label: 'Dashboard',
        icon: 'i-lucide-layout-dashboard',
        to: '/driver'
      },
      {
        label: 'Current Trip',
        icon: 'i-lucide-navigation',
        to: '/driver/current-trip'
      },
      {
        label: 'Demand Map',
        icon: 'i-lucide-map-pinned',
        to: '/driver/demand-map'
      },
      {
        label: 'Trip History',
        icon: 'i-lucide-history',
        to: '/driver/history'
      }
    ]
  }

  if (visibleIsLGU.value) {
    return [
      {
        label: 'Command Center',
        icon: 'i-lucide-layout-dashboard',
        to: '/lgu'
      },
      {
        label: 'Live Mobility',
        icon: 'i-lucide-map',
        to: '/lgu/live-mobility'
      },
      {
        label: 'Demand Analysis',
        icon: 'i-lucide-chart-no-axes-combined',
        to: '/lgu/demand'
      },
      {
        label: 'Transport Data',
        icon: 'i-lucide-database',
        to: '/lgu/transport-data'
      },
      {
        label: 'Disruptions',
        icon: 'i-lucide-triangle-alert',
        to: '/lgu/disruptions'
      },
      {
        label: 'Passenger Reports',
        icon: 'i-lucide-message-square-warning',
        to: '/lgu/reports'
      },
      {
        label: 'Recommendations',
        icon: 'i-lucide-brain-circuit',
        to: '/lgu/recommendations'
      }
    ]
  }

  if (visibleIsAdministrator.value) {
    return [
      {
        label: 'Dashboard',
        icon: 'i-lucide-layout-dashboard',
        to: '/admin'
      },
      {
        label: 'Routes',
        icon: 'i-lucide-route',
        to: '/admin/routes'
      },
      {
        label: 'Transport Data',
        icon: 'i-lucide-database',
        to: '/admin/transport-data'
      },
      {
        label: 'Stops',
        icon: 'i-lucide-map-pin',
        to: '/admin/stops'
      },
      {
        label: 'Vehicles',
        icon: 'i-lucide-bus-front',
        to: '/admin/vehicles'
      },
      {
        label: 'Drivers',
        icon: 'i-lucide-id-card',
        to: '/admin/drivers'
      },
      {
        label: 'Cooperatives',
        icon: 'i-lucide-building-2',
        to: '/admin/cooperatives'
      },
      {
        label: 'Users',
        icon: 'i-lucide-users',
        to: '/admin/users'
      },
      {
        label: 'Passenger Reports',
        icon: 'i-lucide-message-square-warning',
        to: '/lgu/reports'
      },
      {
        label: 'Settings',
        icon: 'i-lucide-settings',
        to: '/admin/settings'
      }
    ]
  }

  return []
})

const workspaceHome = computed(() => {
  if (visibleIsPassenger.value) {
    return '/passenger'
  }

  if (visibleIsDriver.value) {
    return '/driver'
  }

  if (visibleIsLGU.value) {
    return '/lgu'
  }

  if (visibleIsAdministrator.value) {
    return '/admin'
  }

  return '/'
})

const roleLabel = computed(() => {
  if (visibleIsPassenger.value) {
    return 'Passenger'
  }

  if (visibleIsDriver.value) {
    return 'Driver'
  }

  if (visibleIsLGU.value) {
    return 'LGU'
  }

  if (visibleIsAdministrator.value) {
    return 'Administrator'
  }

  return visibleRole.value || 'User'
})

const userInitial = computed(() => {
  return (
    visibleUser.value?.username
      ?.charAt(0)
      ?.toUpperCase() || 'P'
  )
})

const roleMeta = computed(() => {
  if (visibleIsDriver.value) {
    return {
      icon: 'i-lucide-bus-front',
      active:
        'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
      badge:
        'bg-emerald-100 text-emerald-700 ring-emerald-500/25',
      iconBox:
        'bg-emerald-100 text-emerald-700'
    }
  }

  if (visibleIsLGU.value) {
    return {
      icon: 'i-lucide-landmark',
      active:
        'border-teal-500/30 bg-teal-500/10 text-teal-700',
      badge:
        'bg-teal-100 text-teal-700 ring-teal-500/25',
      iconBox:
        'bg-teal-100 text-teal-700'
    }
  }

  if (visibleIsAdministrator.value) {
    return {
      icon: 'i-lucide-shield-check',
      active:
        'border-green-700/25 bg-green-700/10 text-green-800',
      badge:
        'bg-green-100 text-green-800 ring-green-700/20',
      iconBox:
        'bg-green-100 text-green-800'
    }
  }

  return {
    icon: 'i-lucide-user-round',
    active:
      'border-lime-500/30 bg-lime-300/15 text-lime-700',
    badge:
      'bg-lime-100 text-lime-700 ring-lime-500/25',
    iconBox:
      'bg-lime-100 text-lime-700'
  }
})

const isActive = (to: string) => {
  if (route.path === to) {
    return true
  }

  const workspaceRoots = [
    '/passenger',
    '/driver',
    '/lgu',
    '/admin'
  ]

  if (workspaceRoots.includes(to)) {
    return false
  }

  return route.path.startsWith(`${to}/`)
}

async function handleLogout() {
  if (loggingOut.value) {
    return
  }

  loggingOut.value = true
  isSidebarOpen.value = false

  try {
    await logout()
  } catch (error: any) {
    toast.add({
      title: 'Unable to log out',
      description:
        error?.data?.error?.message ||
        error?.statusMessage ||
        'Please try again.',
      color: 'error'
    })
  } finally {
    loggingOut.value = false
  }
}

watch(
  () => route.fullPath,
  () => {
    isSidebarOpen.value = false
  }
)
</script>

<template>
  <div class="min-h-screen">
    <!-- Desktop sidebar -->
    <aside v-pamana-reveal="{ preset: 'fade' }"
      class="glass-solid fixed inset-y-4 left-4 z-40 hidden w-64 overflow-hidden rounded-30 shadow-[0_28px_60px_-34px_rgba(0,0,0,0.32)] lg:flex lg:flex-col"
    >
      <!-- Desktop PAMANA logo -->
      <div
        class="glow-lime flex h-24 shrink-0 items-center border-b border-neutral-900/10 px-4 py-3"
      >
        <NuxtLink data-pamana-feedback
          :to="workspaceHome"
          class="relative z-10 inline-flex w-full min-w-0 flex-col items-start"
        >
          <div
            class="flex h-14 w-48 max-w-full items-center justify-start rounded-xl bg-transparent px-1 py-1 shadow-none"
          >
            <img
              src="/pamana-logo.png"
              alt="PAMANA"
              width="192"
              height="56"
              class="h-full w-full object-contain object-left drop-shadow-none"
            >
          </div>

        </NuxtLink>
      </div>

      <!-- Workspace badge -->
      <div class="px-4 pb-2 pt-5">
        <span
          class="pill ring-1"
          :class="roleMeta.badge"
        >
          <UIcon
            :name="roleMeta.icon"
            class="size-3.5"
          />

          {{ roleLabel }} workspace
        </span>
      </div>

      <!-- Desktop navigation -->
      <nav
        class="flex-1 space-y-1 overflow-y-auto px-4 pb-4 pt-2"
        aria-label="Workspace navigation"
      >
        <NuxtLink data-pamana-feedback
          v-for="item in navigationItems"
          :key="item.to"
          :to="item.to"
          class="group flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-medium transition"
          :class="
            isActive(item.to)
              ? roleMeta.active
              : 'border-transparent text-neutral-500 hover:border-neutral-900/10 hover:bg-neutral-900/[0.04] hover:text-neutral-900'
          "
        >
          <span
            class="flex size-8 items-center justify-center rounded-xl transition"
            :class="
              isActive(item.to)
                ? roleMeta.iconBox
                : 'bg-neutral-900/[0.035] text-neutral-400 group-hover:bg-white'
            "
          >
            <UIcon
              :name="item.icon"
              class="size-4"
            />
          </span>

          <span>
            {{ item.label }}
          </span>
        </NuxtLink>
      </nav>

      <!-- Desktop user account -->
      <div
        class="border-t border-neutral-900/10 bg-neutral-900/[0.018] p-4"
      >
        <div
          class="mb-3 flex items-center gap-3 rounded-2xl border border-neutral-900/[0.06] bg-white/65 p-3"
        >
          <span
            class="flex size-9 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold"
            :class="roleMeta.iconBox"
          >
            {{ userInitial }}
          </span>

          <div class="min-w-0">
            <p
              class="truncate text-sm font-semibold text-neutral-900"
            >
              {{ visibleUser?.username || 'PAMANA User' }}
            </p>

            <p
              class="truncate text-xs text-neutral-500"
            >
              {{ roleLabel }}
            </p>
          </div>
        </div>

        <UButton data-pamana-feedback
          color="neutral"
          variant="soft"
          block
          icon="i-lucide-log-out"
          class="rounded-full bg-neutral-900/[0.04] text-neutral-700 hover:bg-neutral-900/[0.06]"
          :loading="loggingOut"
          :disabled="loggingOut"
          @click="handleLogout"
        >
          Logout
        </UButton>
      </div>
    </aside>

    <!-- Mobile header -->
    <header
      class="glass-solid sticky top-0 z-30 flex h-16 items-center border-x-0 border-t-0 px-3 py-1.5 sm:px-4 lg:hidden"
    >
      <button data-pamana-feedback
        type="button"
        :aria-expanded="isSidebarOpen"
        aria-controls="mobile-workspace-navigation"
        :aria-label="isSidebarOpen ? 'Close navigation' : 'Open navigation'"
        class="flex size-11 items-center justify-center rounded-xl text-neutral-700 hover:bg-neutral-900/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-700"
        @click="isSidebarOpen = !isSidebarOpen"
      >
        <UIcon :name="isSidebarOpen ? 'i-lucide-x' : 'i-lucide-menu'" class="size-6" />
      </button>
    </header>

    <!-- Mobile navigation drawer -->
    <USlideover v-model:open="isSidebarOpen" side="left" title="Workspace navigation" description="Navigate your PAMANA workspace" :ui="{ content: 'w-[min(21rem,calc(100vw-2.5rem))] max-w-none' }">
      <template #content>
        <div id="mobile-workspace-navigation" class="glass-solid flex h-full min-h-0 flex-col overflow-y-auto">
              <div class="flex min-h-16 items-center justify-between border-b border-neutral-900/10 px-4">
                <NuxtLink data-pamana-feedback
                  :to="workspaceHome"
                  class="flex min-w-0 items-center"
                  @click="isSidebarOpen = false"
                >
                  <img
                    src="/pamana-logo.png"
                    alt="PAMANA"
                    width="144"
                    height="44"
                    class="h-10 w-36 object-contain object-left"
                  >
                </NuxtLink>

                <button data-pamana-feedback
                  type="button"
                  aria-label="Close navigation"
                  class="flex size-11 shrink-0 items-center justify-center rounded-xl text-neutral-700 hover:bg-neutral-900/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-700"
                  @click="isSidebarOpen = false"
                >
                  <UIcon name="i-lucide-x" class="size-5" />
                </button>
              </div>

              <div class="px-4 pb-2 pt-4">
                <span class="pill ring-1" :class="roleMeta.badge">
                  <UIcon :name="roleMeta.icon" class="size-3.5" />
                  {{ roleLabel }} workspace
                </span>
              </div>

              <nav
                class="flex-1 space-y-1 overflow-y-auto p-4"
                aria-label="Mobile workspace navigation"
              >
                <NuxtLink data-pamana-feedback
                  v-for="item in navigationItems"
                  :key="item.to"
                  :to="item.to"
                  class="flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition"
                  :class="isActive(item.to)
                    ? roleMeta.active
                    : 'border-transparent text-neutral-700 hover:border-neutral-900/10 hover:bg-neutral-900/[0.04]'"
                  @click="isSidebarOpen = false"
                >
                  <span
                    class="flex size-9 shrink-0 items-center justify-center rounded-xl"
                    :class="isActive(item.to)
                      ? roleMeta.iconBox
                      : 'bg-neutral-900/[0.05] text-neutral-600'"
                  >
                    <UIcon :name="item.icon" class="size-4" />
                  </span>
                  <span>{{ item.label }}</span>
                  <UIcon name="i-lucide-chevron-right" class="ml-auto size-4 text-neutral-400" />
                </NuxtLink>
              </nav>

              <div class="border-t border-neutral-900/10 p-4">
                <div class="mb-3 flex min-w-0 items-center gap-3 rounded-2xl border border-neutral-900/[0.06] bg-white/75 p-3">
                  <span
                    class="flex size-10 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold"
                    :class="roleMeta.iconBox"
                  >
                    {{ userInitial }}
                  </span>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-semibold text-neutral-900">
                      {{ visibleUser?.username || 'PAMANA User' }}
                    </p>
                    <p class="truncate text-xs text-neutral-600">
                      {{ visibleUser?.email || roleLabel }}
                    </p>
                  </div>
                </div>

                <UButton data-pamana-feedback
                  block
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-log-out"
                  class="min-h-11 rounded-xl bg-neutral-900/[0.05] font-semibold text-neutral-800 hover:bg-neutral-900/[0.08]"
                  :loading="loggingOut"
                  :disabled="loggingOut"
                  @click="handleLogout"
                >
                  Logout
                </UButton>
              </div>

        </div>
      </template>
    </USlideover>

    <!-- Main content -->
    <div class="lg:pl-72">
      <!-- Desktop top bar -->
      <header
        class="glass-solid sticky top-0 z-20 hidden h-20 items-center justify-between border-x-0 border-t-0 px-8 lg:flex"
      >
        <div class="flex items-center gap-3">
          <span
            class="flex size-10 items-center justify-center rounded-2xl"
            :class="roleMeta.iconBox"
          >
            <UIcon
              :name="roleMeta.icon"
              class="size-5"
            />
          </span>

          <div>
            <p
              class="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500"
            >
              PAMANA
            </p>

            <p
              class="font-display text-lg font-semibold leading-tight text-neutral-900"
            >
              {{ roleLabel }} Workspace
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <UBadge
            class="ring-1"
            :class="roleMeta.badge"
            variant="soft"
          >
            Online
          </UBadge>

          <div class="text-right">
            <p
              class="text-sm font-medium text-neutral-900"
            >
              {{ visibleUser?.username || 'PAMANA User' }}
            </p>

            <p class="text-xs text-neutral-500">
              {{ visibleUser?.email || roleLabel }}
            </p>
          </div>
        </div>
      </header>

      <!-- Page content -->
      <main
        class="workspace-main page-surface mx-auto min-h-[calc(100vh-4rem)] max-w-[1500px] rounded-[30px] p-4 sm:p-6 lg:min-h-[calc(100vh-5rem)] lg:p-8"
      >
        <slot v-if="hydrated" />
        <p v-else role="status" class="text-sm text-neutral-500">Loading your workspace…</p>
      </main>
    </div>
  </div>
</template>
