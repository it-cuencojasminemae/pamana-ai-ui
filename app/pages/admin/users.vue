<script setup lang="ts">
definePageMeta({
  middleware: ['auth', 'admin']
})

useHead({
  title: 'Users | PAMANA'
})

type DirectoryUser = {
  username: string
  email: string
  role: 'Passenger' | 'Driver' | 'LGU' | 'Administrator'
  joined: string
  status: 'Active'
}

const users: DirectoryUser[] = [
  { username: 'juan.delacruz', email: 'juan@mail.com', role: 'Passenger', joined: 'Mar 12, 2026', status: 'Active' },
  { username: 'mark.reyes', email: 'mark.reyes@email.com', role: 'Driver', joined: 'Mar 12, 2026', status: 'Active' },
  { username: 'lgu.pampanga', email: 'lgu@pampanga.gov.ph', role: 'LGU', joined: 'Jan 5, 2026', status: 'Active' },
  { username: 'admin.pampanga', email: 'admin@pamana.gov.ph', role: 'Administrator', joined: 'Jan 1, 2026', status: 'Active' }
]

const searchQuery = ref('')
const selectedRole = ref('All roles')
const roleOptions = ['All roles', 'Passenger', 'Driver', 'LGU', 'Administrator']
const inviteDialogOpen = ref(false)
const detailsDialogOpen = ref(false)
const selectedAccount = ref<DirectoryUser | null>(null)

const filteredUsers = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return users.filter((account) => {
    const matchesRole = selectedRole.value === 'All roles' || account.role === selectedRole.value
    const matchesQuery = !query || [
      account.username,
      account.email,
      account.role,
      account.status
    ].some(value => value.toLowerCase().includes(query))

    return matchesRole && matchesQuery
  })
})

const userCounts = computed(() => [
  { label: 'Total accounts', value: users.length, icon: 'i-lucide-users', tone: 'text-neutral-900' },
  { label: 'Passengers', value: users.filter(user => user.role === 'Passenger').length, icon: 'i-lucide-user-round', tone: 'text-lime-700' },
  { label: 'Transport staff', value: users.filter(user => user.role === 'Driver' || user.role === 'LGU').length, icon: 'i-lucide-bus-front', tone: 'text-teal-700' },
  { label: 'Administrators', value: users.filter(user => user.role === 'Administrator').length, icon: 'i-lucide-shield-check', tone: 'text-emerald-700' }
])

function roleClasses(role: DirectoryUser['role']) {
  if (role === 'Passenger') return 'bg-lime-100 text-lime-800'
  if (role === 'Driver') return 'bg-emerald-100 text-emerald-800'
  if (role === 'LGU') return 'bg-teal-100 text-teal-800'
  return 'bg-indigo-100 text-indigo-800'
}

function showAccountDetails(account: DirectoryUser) {
  selectedAccount.value = account
  detailsDialogOpen.value = true
}
</script>

<template>
  <div class="min-w-0 space-y-5">
    <PamanaPageHeader
      title="Users"
      role="admin"
      subtitle="Review account roles and activity across the PAMANA platform."
    >
      <template #actions>
        <UButton
          icon="i-lucide-user-plus"
          class="w-full justify-center rounded-full font-semibold text-neutral-950 sm:w-auto"
          @click="inviteDialogOpen = true"
        >
          Invite user
        </UButton>
      </template>
    </PamanaPageHeader>

    <section class="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="User account summary">
      <UCard
        v-for="stat in userCounts"
        :key="stat.label"
        class="glass min-w-0 rounded-2xl"
        :ui="{ root: 'ring-0 rounded-2xl', body: 'p-4 sm:p-5' }"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-medium leading-tight text-neutral-600">{{ stat.label }}</p>
          <UIcon :name="stat.icon" class="size-4 shrink-0 text-neutral-500" />
        </div>
        <p class="stat-num mt-2 text-2xl" :class="stat.tone">{{ stat.value }}</p>
      </UCard>
    </section>

    <UCard class="glass min-w-0 rounded-30" :ui="{ root: 'ring-0 rounded-30', body: 'p-4 sm:p-6' }">
      <div class="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div class="min-w-0">
          <h2 class="font-display text-lg font-semibold text-neutral-900">Application users</h2>
          <p class="mt-1 text-sm text-neutral-600">Passenger, driver, LGU, and administrator accounts</p>
        </div>

        <div class="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_12rem] xl:max-w-xl">
          <UInput
            v-model="searchQuery"
            icon="i-lucide-search"
            placeholder="Search name, email, or role"
            aria-label="Search users"
            class="w-full"
          />
          <USelect
            v-model="selectedRole"
            :items="roleOptions"
            aria-label="Filter users by role"
            class="w-full"
          />
        </div>
      </div>

      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs font-medium text-neutral-600" aria-live="polite">
          Showing {{ filteredUsers.length }} of {{ users.length }} accounts
        </p>
        <span class="pill bg-amber-100 text-amber-800">Preview data</span>
      </div>

      <div v-if="filteredUsers.length === 0" class="rounded-2xl border border-dashed border-neutral-300 bg-white/60 px-4 py-10 text-center">
        <UIcon name="i-lucide-users-round" class="mx-auto size-7 text-neutral-400" />
        <p class="mt-2 text-sm font-semibold text-neutral-800">No matching users</p>
        <p class="mt-1 text-xs text-neutral-600">Try changing your search or role filter.</p>
      </div>

      <div v-else>
        <div class="hidden overflow-x-auto lg:block">
          <table class="data-table min-w-[760px]">
          <thead>
            <tr>
              <th>Account</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Status</th>
              <th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="account in filteredUsers" :key="account.username">
              <td class="min-w-[240px]">
                <p class="font-semibold text-neutral-900">{{ account.username }}</p>
                <p class="mt-0.5 text-xs text-neutral-600">{{ account.email }}</p>
              </td>
              <td><span class="pill normal-case" :class="roleClasses(account.role)">{{ account.role }}</span></td>
              <td>{{ account.joined }}</td>
              <td><span class="pill normal-case bg-emerald-100 text-emerald-800">{{ account.status }}</span></td>
              <td class="text-right">
                <UButton
                  color="neutral"
                  variant="soft"
                  size="sm"
                  icon="i-lucide-ellipsis"
                  :aria-label="`View ${account.username} details`"
                  class="rounded-full"
                  @click="showAccountDetails(account)"
                >
                  Details
                </UButton>
              </td>
            </tr>
          </tbody>
          </table>
        </div>

        <div class="space-y-3 lg:hidden">
          <article
            v-for="account in filteredUsers"
            :key="account.username"
            class="rounded-2xl border border-neutral-200/80 bg-white/75 p-4 shadow-sm"
          >
          <div class="flex min-w-0 items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="break-words text-sm font-semibold text-neutral-900">{{ account.username }}</p>
              <p class="mt-1 break-all text-xs text-neutral-600">{{ account.email }}</p>
            </div>
            <span class="pill shrink-0 normal-case bg-emerald-100 text-emerald-800">{{ account.status }}</span>
          </div>
          <div class="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-3">
            <div class="flex items-center gap-2">
              <span class="pill normal-case" :class="roleClasses(account.role)">{{ account.role }}</span>
              <span class="text-xs text-neutral-600">{{ account.joined }}</span>
            </div>
            <UButton
              color="neutral"
              variant="soft"
              size="sm"
              icon="i-lucide-ellipsis"
              :aria-label="`View ${account.username} details`"
              class="rounded-full"
              @click="showAccountDetails(account)"
            >
              Details
            </UButton>
          </div>
          </article>
        </div>
      </div>
    </UCard>

    <p class="text-xs leading-relaxed text-neutral-600">
      This directory currently uses preview data and is not connected to Strapi user administration.
    </p>

    <USlideover v-model:open="inviteDialogOpen">
      <template #content>
        <div class="glass-solid flex h-full flex-col">
          <div class="flex min-h-20 items-center justify-between gap-4 border-b border-neutral-900/10 px-5 sm:px-6">
            <div class="flex min-w-0 items-center gap-3">
              <span class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-lime-100 text-lime-800">
                <UIcon name="i-lucide-user-plus" class="size-5" />
              </span>
              <div class="min-w-0">
                <h2 class="font-display text-lg font-semibold text-neutral-900">Invite a user</h2>
                <p class="text-xs text-neutral-600">Account invitations are not connected yet</p>
              </div>
            </div>

            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              aria-label="Close invite user panel"
              @click="inviteDialogOpen = false"
            />
          </div>

          <div class="flex-1 p-5 sm:p-6">
            <div class="rounded-2xl border border-lime-700/15 bg-lime-50/80 p-4 sm:p-5">
              <div class="flex items-start gap-3">
                <UIcon name="i-lucide-info" class="mt-0.5 size-5 shrink-0 text-lime-800" />
                <div>
                  <h3 class="text-sm font-semibold text-neutral-900">Invitations are not available yet</h3>
                  <p class="mt-2 text-sm leading-relaxed text-neutral-700">
                    This user directory currently uses preview data and is not connected to account administration.
                    No invitation can be sent from this page yet.
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </template>
    </USlideover>

    <UModal v-model:open="detailsDialogOpen">
      <template #content>
        <UCard v-if="selectedAccount" :ui="{ root: 'rounded-3xl' }">
          <template #header>
            <div class="flex min-w-0 items-center gap-3">
              <span class="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-700">
                <UIcon name="i-lucide-user-round" class="size-5" />
              </span>
              <div class="min-w-0">
                <h3 class="truncate font-display text-lg font-semibold text-neutral-900">{{ selectedAccount.username }}</h3>
                <p class="truncate text-xs text-neutral-600">{{ selectedAccount.email }}</p>
              </div>
            </div>
          </template>

          <dl class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-xl bg-neutral-50 p-3">
              <dt class="text-xs font-medium text-neutral-600">Role</dt>
              <dd class="mt-1"><span class="pill normal-case" :class="roleClasses(selectedAccount.role)">{{ selectedAccount.role }}</span></dd>
            </div>
            <div class="rounded-xl bg-neutral-50 p-3">
              <dt class="text-xs font-medium text-neutral-600">Status</dt>
              <dd class="mt-1"><span class="pill normal-case bg-emerald-100 text-emerald-800">{{ selectedAccount.status }}</span></dd>
            </div>
            <div class="rounded-xl bg-neutral-50 p-3 sm:col-span-2">
              <dt class="text-xs font-medium text-neutral-600">Joined</dt>
              <dd class="mt-1 text-sm font-semibold text-neutral-900">{{ selectedAccount.joined }}</dd>
            </div>
          </dl>

          <p class="mt-4 text-xs text-neutral-600">Account details are from the local preview directory.</p>

          <template #footer>
            <div class="flex justify-end">
              <UButton color="neutral" variant="soft" class="rounded-full" @click="detailsDialogOpen = false">Close</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
