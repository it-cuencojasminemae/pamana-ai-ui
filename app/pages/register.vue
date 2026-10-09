<script setup lang="ts">
// @ts-nocheck
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: false,
  middleware: ['guest']
})

useHead({
  title: 'Register | PAMANA'
})

const {
  register,
  redirectByRole,
  loading
} = useAuth()

const toast = useToast()
const showPassword = ref(false)

const schema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required'),

  lastName: z
    .string()
    .min(1, 'Last name is required'),

  username: z
    .string()
    .min(3, 'Username must be at least 3 characters'),

  email: z
    .string()
    .email('Enter a valid email address'),

  contactNumber: z
    .string()
    .optional(),

  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  contactNumber: '',
  password: ''
})

const getRegisterErrorMessage = (error: any) => {
  const message =
    error?.data?.error?.message ||
    error?.statusMessage ||
    error?.message

  if (message === 'Email or Username are already taken') {
    return 'That email or username is already registered.'
  }

  return message || 'Unable to create your account. Please try again.'
}

const onSubmit = async (
  event: FormSubmitEvent<Schema>
) => {
  try {
    await register(event.data)

    toast.add({
      title: 'Account created',
      description: 'Welcome to PAMANA.',
      color: 'success'
    })

    await redirectByRole()
  } catch (error) {
    console.error('Registration error:', error)

    toast.add({
      title: 'Registration failed',
      description: getRegisterErrorMessage(error),
      color: 'error'
    })
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-app auth-app--register">
      <div class="auth-sheet">
        <div class="form-container">
          <div v-pamana-reveal class="form-brand">
            <img
              src="/pamana-logo.png"
              alt="PAMANA logo"
              class="form-brand-logo"
            >
            <span class="brand-meaning">Pampanga AI-powered Mobility Access and Navigation Assistant</span>
          </div>

          <header v-pamana-reveal class="form-header">
            <div>
              <h2>Create your account</h2>
            </div>

            <div class="header-icon" aria-hidden="true">
              <UIcon name="i-lucide-user-plus" class="size-5" />
            </div>
          </header>

          <p class="form-intro">
            Passenger registration only. Staff accounts are managed by
            PAMANA administrators.
          </p>

          <UForm v-pamana-reveal="{ preset: 'fade' }"
            :schema="schema"
            :state="state"
            class="auth-form"
            @submit="onSubmit"
          >
            <div class="name-grid">
              <UFormField
                class="first-name-field"
                label="First name"
                name="firstName"
                required
              >
                <UInput
                  v-model="state.firstName"
                  placeholder="Juan"
                  icon="i-lucide-user-round"
                  autocomplete="given-name"
                  color="neutral"
                  variant="outline"
                  size="xl"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                class="last-name-field"
                label="Last name"
                name="lastName"
                required
              >
                <UInput
                  v-model="state.lastName"
                  placeholder="Dela Cruz"
                  icon="i-lucide-user-round"
                  autocomplete="family-name"
                  color="neutral"
                  variant="outline"
                  size="xl"
                  class="w-full"
                />
              </UFormField>
            </div>

            <UFormField
              class="username-field"
              label="Username"
              name="username"
              required
            >
              <UInput
                v-model="state.username"
                placeholder="Choose a username"
                icon="i-lucide-at-sign"
                autocomplete="username"
                color="neutral"
                variant="outline"
                size="xl"
                class="w-full"
              />
            </UFormField>

            <UFormField
              class="email-field"
              label="Email address"
              name="email"
              required
            >
              <UInput
                v-model="state.email"
                type="email"
                placeholder="name@example.com"
                icon="i-lucide-mail"
                autocomplete="email"
                inputmode="email"
                color="neutral"
                variant="outline"
                size="xl"
                class="w-full"
              />
            </UFormField>

            <UFormField
              class="contact-field"
              label="Contact number"
              name="contactNumber"
              hint="Optional"
            >
              <UInput
                v-model="state.contactNumber"
                type="tel"
                placeholder="09XX XXX XXXX"
                icon="i-lucide-phone"
                autocomplete="tel"
                inputmode="tel"
                color="neutral"
                variant="outline"
                size="xl"
                class="w-full"
              />
            </UFormField>

            <UFormField
              class="password-field"
              label="Password"
              name="password"
              required
              hint="At least 6 characters"
            >
              <UInput
                v-model="state.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Create a secure password"
                icon="i-lucide-lock-keyhole"
                autocomplete="new-password"
                color="neutral"
                variant="outline"
                size="xl"
                class="w-full"
              >
                <template #trailing>
                  <UButton data-pamana-feedback
                    type="button"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                    :aria-label="showPassword ? 'Hide password' : 'Show password'"
                    class="password-toggle"
                    @click="showPassword = !showPassword"
                  />
                </template>
              </UInput>
            </UFormField>

            <UButton data-pamana-feedback
              type="submit"
              block
              size="xl"
              :loading="loading"
              :disabled="loading"
              class="primary-action submit-action"
            >
              <span>Create account</span>
              <UIcon
                v-if="!loading"
                name="i-lucide-arrow-right"
                class="size-5"
              />
            </UButton>
          </UForm>

          <div class="signin-row">
            <span>Already have an account?</span>

            <NuxtLink to="/login">
              Sign in
            </NuxtLink>
          </div>

        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>

.auth-page {
  min-height: 100vh;
  min-height: 100dvh;
  background:
    linear-gradient(rgba(14, 38, 25, 0.08), rgba(14, 38, 25, 0.18)),
    url('/pamana-login-bg.png') center / cover no-repeat;
}

.auth-app {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  grid-template-rows: minmax(260px, 38vh) 1fr;
  border: 1px solid rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* HERO */
.auth-hero {
  position: relative;
  min-height: 260px;
  overflow: hidden;
  padding:
    max(1.1rem, env(safe-area-inset-top))
    max(1.15rem, env(safe-area-inset-right))
    2.8rem
    max(1.15rem, env(safe-area-inset-left));
  background:
    url('/pamana-login-bg.png')
    18% center / cover no-repeat;
}

.auth-hero-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(4, 22, 17, 0.34), rgba(4, 22, 17, 0.76)),
    linear-gradient(110deg, rgba(7, 46, 35, 0.58), rgba(7, 46, 35, 0.05));
}

.hero-top,
.hero-copy {
  position: relative;
  z-index: 1;
}

.hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 1rem;
}

.brand {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
}

.brand-logo {
  width: 142px;
  height: auto;
  object-fit: contain;
  object-position: center;
  filter:
    drop-shadow(0 1px 0 rgba(255, 255, 255, 0.65))
    drop-shadow(0 4px 12px rgba(0, 0, 0, 0.18));
}

.brand-tagline {
  max-width: 15rem;
  color: rgba(255, 255, 255, 0.94);
  font-size: 0.68rem;
  font-weight: 650;
  line-height: 1.35;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}

.passenger-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
  min-height: 36px;
  padding: 0.45rem 0.68rem;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 999px;
  color: #fff;
  background: rgba(8, 38, 30, 0.44);
  backdrop-filter: blur(12px);
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
}

.hero-copy {
  position: absolute;
  left: max(1.15rem, env(safe-area-inset-left));
  right: max(1.15rem, env(safe-area-inset-right));
  bottom: 2.8rem;
  max-width: 520px;
}

.eyebrow {
  margin: 0 0 0.45rem;
  color: #d9f99d;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-copy h1 {
  margin: 0;
  max-width: 360px;
  color: #fff;
  font-size: clamp(1.85rem, 8vw, 2.5rem);
  font-weight: 850;
  letter-spacing: -0.045em;
  line-height: 1.02;
  text-wrap: balance;
}

.hero-copy > p:last-child {
  max-width: 440px;
  margin: 0.75rem 0 0;
  color: rgba(255, 255, 255, 0.88);
  font-size: 0.86rem;
  font-weight: 500;
  line-height: 1.55;
}

/* FORM SHEET */
.auth-sheet {
  position: relative;
  z-index: 2;
  margin-top: -1.65rem;
  border-radius: 1.8rem 1.8rem 0 0;
  border: 1px solid rgba(255, 255, 255, 0.68);
  background: linear-gradient(145deg, rgba(246, 251, 241, 0.58), rgba(232, 243, 226, 0.45));
  backdrop-filter: blur(16px) saturate(130%);
  -webkit-backdrop-filter: blur(16px) saturate(130%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.85),
    0 20px 52px rgba(19, 48, 29, 0.2);
}

.sheet-handle {
  width: 42px;
  height: 4px;
  margin: 0.7rem auto 0;
  border-radius: 999px;
  background: #d7ddd4;
}

.form-container {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  padding:
    1.2rem
    max(1.2rem, env(safe-area-inset-right))
    max(1.5rem, env(safe-area-inset-bottom))
    max(1.2rem, env(safe-area-inset-left));
}

.form-brand {
  display: inline-flex;
  margin-bottom: 1rem;
}

.form-brand-logo {
  display: block;
  width: clamp(126px, 36vw, 150px);
  height: auto;
  object-fit: contain;
}

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.form-kicker {
  margin: 0 0 0.2rem;
  color: #65a30d;
  font-size: 0.78rem;
  font-weight: 800;
}

.form-header h2 {
  margin: 0;
  color: #17211a;
  font-size: 1.65rem;
  font-weight: 850;
  letter-spacing: -0.035em;
  line-height: 1.1;
}

.header-icon {
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 14px;
  color: #4d7c0f;
  background: #f1f9df;
}

.form-intro {
  margin: 0.6rem 0 0;
  color: #667068;
  font-size: 0.88rem;
  line-height: 1.55;
}

.auth-form {
  display: grid;
  gap: 1.05rem;
  margin-top: 1.45rem;
}

.name-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.95rem;
}

.auth-form :deep(label) {
  margin-bottom: 0.45rem;
  color: #2b342d !important;
  font-size: 0.82rem;
  font-weight: 750 !important;
}

.password-toggle {
  min-width: 44px;
  min-height: 44px;
  border-radius: 12px !important;
  color: #59625b !important;
}

.primary-action {
  min-height: 54px;
  margin-top: 0.25rem;
  display: flex !important;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  border-radius: 15px !important;
  color: #13200f !important;
  background: linear-gradient(135deg, #b7ee4e, #8ed11d) !important;
  font-size: 0.95rem;
  font-weight: 850 !important;
  box-shadow: 0 12px 26px rgba(101, 163, 13, 0.22);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    filter 160ms ease;
}

.primary-action:hover:not(:disabled) {
  filter: brightness(0.98);
  box-shadow: 0 15px 30px rgba(101, 163, 13, 0.27);
}

.primary-action:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.signin-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 1.15rem;
  color: #6d776f;
  font-size: 0.8rem;
}

.signin-row a {
  color: #4d7c0f;
  font-weight: 800;
  text-decoration: none;
}

.signin-row a:hover {
  text-decoration: underline;
}

.pilot-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  margin-top: 1.15rem;
  color: #7a837c;
  font-size: 0.7rem;
  line-height: 1.4;
  text-align: center;
}

@media (max-width: 767px) {
  /*
   * MOBILE APP MODE
   * Fixed to the viewport: no vertical page scrolling.
   * Registration is arranged in compact two-column rows so
   * everything stays visible and readable.
   */
  .auth-page {
    width: 100%;
    height: 100vh;
    height: 100dvh;
    min-height: 0;
    overflow: hidden !important;
  }

  .auth-page {
    display: block;
  }

  .auth-app {
    width: 100%;
    height: 100%;
    min-height: 0;
    grid-template-rows: clamp(108px, 18vh, 145px) minmax(0, 1fr);
    overflow: hidden;
    background: transparent;
  }

  /* Short mobile hero, same visual language as login */
  .auth-hero {
    min-height: 0;
    height: 100%;
    padding:
      max(0.65rem, env(safe-area-inset-top))
      max(0.85rem, env(safe-area-inset-right))
      1.2rem
      max(0.85rem, env(safe-area-inset-left));
    background-position: 18% center;
  }

  .hero-top {
    align-items: center;
  }

  .brand-logo {
    width: clamp(132px, 34vw, 152px);
    height: clamp(54px, 16vw, 62px);
  }

  .brand-tagline {
    max-width: 13rem;
    font-size: clamp(0.52rem, 1.7vw, 0.58rem);
  }

  .passenger-chip {
    min-height: 31px;
    padding: 0.32rem 0.5rem;
    font-size: clamp(0.56rem, 1.8vw, 0.64rem);
  }

  /* Hide long marketing copy on phones to prioritize the form */
  .hero-copy {
    display: none;
  }

  /* White application sheet */
  .auth-sheet {
    display: block;
    min-height: 0;
    height: calc(100% + 0.7rem);
    margin-top: -0.7rem;
    overflow: hidden;
    border-radius: 1.45rem 1.45rem 0 0;
    box-shadow: 0 -8px 24px rgba(10, 31, 23, 0.1);
  }

  .sheet-handle {
    width: 38px;
    height: 4px;
    margin-top: 0.45rem;
  }

  .form-container {
    width: 100%;
    height: calc(100% - 0.7rem);
    max-width: none;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
    padding:
      0.5rem
      max(0.85rem, env(safe-area-inset-right))
      max(0.45rem, env(safe-area-inset-bottom))
      max(0.85rem, env(safe-area-inset-left));
  }

  .form-header {
    flex: 0 0 auto;
    gap: 0.5rem;
  }

  .form-kicker {
    margin-bottom: 0.02rem;
    font-size: 0.64rem;
  }

  .form-header h2 {
    font-size: clamp(1.15rem, 4.5vw, 1.4rem);
  }

  .header-icon {
    width: 34px;
    height: 34px;
    border-radius: 10px;
  }

  .form-intro {
    display: none;
  }

  /*
   * Three compact rows:
   * 1. First name | Last name
   * 2. Username   | Email
   * 3. Contact    | Password
   */
  .auth-form {
    flex: 0 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas:
      "first last"
      "username email"
      "contact password"
      "submit submit";
    gap: clamp(0.28rem, 1vh, 0.48rem) 0.5rem;
    margin-top: clamp(0.4rem, 1.1vh, 0.65rem);
  }

  .name-grid {
    display: contents;
  }

  .first-name-field { grid-area: first; }
  .last-name-field { grid-area: last; }
  .username-field { grid-area: username; }
  .email-field { grid-area: email; }
  .contact-field { grid-area: contact; }
  .password-field { grid-area: password; }
  .submit-action { grid-area: submit; }

  .auth-form > * {
    min-width: 0;
    margin: 0 !important;
  }

  .auth-form :deep(label) {
    margin-bottom: 0.12rem;
    color: #2b342d !important;
    font-size: clamp(0.62rem, 1.8vw, 0.72rem);
    line-height: 1.15;
  }

  .auth-form :deep(input) {
    width: 100%;
    height: clamp(38px, 5.7vh, 44px);
    min-height: clamp(38px, 5.7vh, 44px);
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
    border-radius: 11px !important;
    font-size: 16px !important;
  }

  .auth-form :deep(input::placeholder) {
    font-size: clamp(0.68rem, 2vw, 0.78rem);
  }

  /* Hide hints on compact mobile screen; validation errors still appear */
  .auth-form :deep([data-slot="hint"]) {
    display: none;
  }

  .password-toggle {
    min-width: 34px;
    min-height: 34px;
    padding: 0 !important;
  }

  .primary-action {
    min-height: clamp(40px, 6vh, 46px);
    margin-top: 0.08rem;
    border-radius: 12px !important;
    font-size: 0.82rem;
  }

  .signin-row {
    flex: 0 0 auto;
    gap: 0.25rem;
    margin-top: clamp(0.25rem, 0.8vh, 0.45rem);
    font-size: clamp(0.66rem, 1.9vw, 0.76rem);
    line-height: 1.2;
  }

  .pilot-note {
    flex: 0 0 auto;
    display: flex;
    margin-top: clamp(0.18rem, 0.6vh, 0.35rem);
    font-size: clamp(0.56rem, 1.6vw, 0.66rem);
    line-height: 1.2;
  }
}

/* Narrow phones: make spacing tighter but keep 2-column layout */
@media (max-width: 380px) {
  .auth-app {
    grid-template-rows: clamp(92px, 16vh, 120px) minmax(0, 1fr);
  }

  .brand-logo {
    width: 104px;
  }

  .passenger-chip {
    gap: 0.2rem;
    min-height: 28px;
    padding: 0.28rem 0.4rem;
    font-size: 0.54rem;
  }

  .form-container {
    padding-left: max(0.65rem, env(safe-area-inset-left));
    padding-right: max(0.65rem, env(safe-area-inset-right));
  }

  .auth-form {
    column-gap: 0.35rem;
  }

  .auth-form :deep(label) {
    font-size: 0.61rem;
  }

  .auth-form :deep(input::placeholder) {
    font-size: 0.66rem;
  }

  .pilot-note {
    display: none;
  }
}

/* Short-height phones: reduce vertical density further */
@media (max-height: 700px) and (max-width: 767px) {
  .auth-app {
    grid-template-rows: clamp(78px, 13vh, 102px) minmax(0, 1fr);
  }

  .auth-hero {
    padding-top: max(0.4rem, env(safe-area-inset-top));
    padding-bottom: 0.75rem;
  }

  .brand-logo {
    width: 102px;
    height: 44px;
  }

  .brand-tagline {
    max-width: 10rem;
    font-size: 0.5rem;
  }

  .passenger-chip {
    min-height: 28px;
  }

  .sheet-handle {
    margin-top: 0.3rem;
  }

  .form-container {
    height: calc(100% - 0.45rem);
    padding-top: 0.3rem;
    padding-bottom: max(0.3rem, env(safe-area-inset-bottom));
  }

  .form-header h2 {
    font-size: 1.12rem;
  }

  .header-icon {
    width: 30px;
    height: 30px;
  }

  .auth-form {
    gap: 0.2rem 0.4rem;
    margin-top: 0.3rem;
  }

  .auth-form :deep(input) {
    height: 36px;
    min-height: 36px;
  }

  .password-toggle {
    min-width: 30px;
    min-height: 30px;
  }

  .primary-action {
    min-height: 38px;
  }

  .signin-row {
    margin-top: 0.2rem;
  }

  .pilot-note {
    display: none;
  }
}

/* Very short landscape-like phone screens */
@media (max-height: 580px) and (max-width: 767px) {
  .auth-app {
    grid-template-rows: clamp(86px, 15vh, 98px) minmax(0, 1fr);
  }

  .brand-logo {
    width: 102px;
    height: 44px;
  }

  .brand-tagline {
    max-width: 9rem;
    font-size: 0.48rem;
  }

  .passenger-chip {
    min-height: 25px;
    font-size: 0.5rem;
  }

  .form-kicker {
    display: none;
  }

  .form-brand {
    display: none;
  }

  .header-icon {
    display: none;
  }

  .auth-form :deep(label) {
    font-size: 0.58rem;
  }

  .auth-form :deep(input) {
    height: 32px;
    min-height: 32px;
  }

  .primary-action {
    min-height: 34px;
  }
}

/* Tablet and desktop */
@media (min-width: 640px) {
  .name-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 768px) {
  .auth-page {
    display: grid;
    place-items: center;
    padding: 2rem;
    background:
      linear-gradient(135deg, rgba(14, 38, 25, 0.16), rgba(244, 248, 242, 0.2)),
      url('/pamana-login-bg.png') center / cover fixed;
  }

  .auth-app {
    width: min(1060px, 100%);
    min-height: 650px;
    grid-template-columns: 1.05fr 0.95fr;
    grid-template-rows: none;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.72);
    border-radius: 30px;
    box-shadow:
      0 30px 80px rgba(20, 45, 28, 0.16),
      0 8px 24px rgba(20, 45, 28, 0.08);
  }

  .auth-hero {
    min-height: 650px;
    padding: 2.5rem;
    background-position: 22% center;
  }

  .brand-logo {
    width: 168px;
  }

  .brand-tagline {
    max-width: 16rem;
  }

  .hero-copy {
    left: 2.5rem;
    right: 2.5rem;
    bottom: 3rem;
  }

  .hero-copy h1 {
    max-width: 460px;
    font-size: clamp(2.6rem, 4vw, 4rem);
  }

  .hero-copy > p:last-child {
    font-size: 0.96rem;
  }

  .auth-sheet {
    margin-top: 0;
    display: flex;
    align-items: center;
    border-radius: 0;
    border-left: 3px solid rgb(63 98 18 / 0.52);
    box-shadow: inset 1px 0 0 rgb(255 255 255 / 0.9);
  }

  .sheet-handle {
    display: none;
  }

  .form-container {
    max-width: 430px;
    padding: 3rem;
  }

  .form-header h2 {
    font-size: 2rem;
  }

  .auth-form {
    gap: 1rem;
  }
}

@media (min-width: 768px) and (max-width: 899px) {
  .name-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* Keep the login layout on phones without clipping the longer registration form. */
@media (max-width: 767px) {
  .auth-page {
    width: 100%;
    height: auto !important;
    min-height: 100vh !important;
    min-height: 100dvh !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
  }

  .auth-page {
    display: block;
  }

  .auth-app {
    width: 100%;
    height: auto;
    min-height: 100vh;
    min-height: 100dvh;
    grid-template-rows: minmax(260px, 42svh) 1fr;
    overflow: visible;
  }

  .auth-hero {
    height: auto;
    min-height: 260px;
    padding:
      max(1.1rem, env(safe-area-inset-top))
      max(1.15rem, env(safe-area-inset-right))
      2.8rem
      max(1.15rem, env(safe-area-inset-left));
    background-position: 18% center;
  }

  .hero-top {
    align-items: flex-start;
  }

  .brand-logo {
    width: clamp(126px, 36vw, 142px);
    height: auto;
  }

  .brand-tagline {
    max-width: min(15rem, 48vw);
    font-size: 0.58rem;
  }

  .hero-copy {
    display: block;
  }

  .auth-sheet {
    height: auto;
    min-height: 0;
    margin-top: -1.65rem;
    overflow: visible;
    border-radius: 1.8rem 1.8rem 0 0;
  }

  .sheet-handle {
    width: 42px;
    height: 4px;
    margin-top: 0.7rem;
  }

  .form-container {
    width: 100%;
    height: auto;
    max-width: 480px;
    display: block;
    justify-content: initial;
    overflow: visible;
    padding:
      1.2rem
      max(1.2rem, env(safe-area-inset-right))
      max(1.5rem, env(safe-area-inset-bottom))
      max(1.2rem, env(safe-area-inset-left));
  }

  .form-header {
    gap: 1rem;
  }

  .form-kicker {
    margin-bottom: 0.2rem;
    font-size: 0.78rem;
  }

  .form-header h2 {
    font-size: 1.65rem;
  }

  .header-icon {
    width: 44px;
    height: 44px;
    border-radius: 14px;
  }

  .form-intro {
    display: block;
    margin-top: 0.6rem;
    font-size: 0.88rem;
    line-height: 1.55;
  }

  .auth-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: none;
    gap: 1.05rem;
    margin-top: 1.45rem;
  }

  .name-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1.05rem;
  }

  .first-name-field,
  .last-name-field,
  .username-field,
  .email-field,
  .contact-field,
  .password-field,
  .submit-action {
    grid-area: auto;
  }

  .auth-form > * {
    min-width: 0;
    margin: 0;
  }

  .auth-form :deep(label) {
    margin-bottom: 0.45rem;
    font-size: 0.82rem;
  }

  .auth-form :deep(input) {
    height: auto;
    min-height: 52px;
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
    border-radius: 14px !important;
    font-size: 16px !important;
  }

  .auth-form :deep(input::placeholder) {
    font-size: inherit;
  }

  .auth-form :deep([data-slot="hint"]) {
    display: block;
  }

  .password-toggle {
    min-width: 44px;
    min-height: 44px;
    padding: initial !important;
  }

  .primary-action {
    min-height: 54px;
    margin-top: 0.25rem;
    border-radius: 15px !important;
    font-size: 0.95rem;
  }

  .signin-row {
    flex: initial;
    gap: 0.35rem;
    margin-top: 1.15rem;
    font-size: 0.8rem;
    line-height: normal;
  }

  .pilot-note {
    flex: initial;
    display: flex;
    margin-top: 1.15rem;
    font-size: 0.7rem;
    line-height: 1.4;
  }
}

@media (max-width: 380px) {
  .auth-app {
    grid-template-rows: minmax(235px, 34vh) 1fr;
  }

  .auth-hero {
    min-height: 235px;
  }

  .brand-logo {
    width: 126px;
  }

  .brand-tagline {
    max-width: 12rem;
    font-size: 0.54rem;
  }

  .passenger-chip {
    min-height: 32px;
    padding: 0.35rem 0.55rem;
    font-size: 0.66rem;
  }

  .hero-copy {
    bottom: 2.55rem;
  }

  .hero-copy h1 {
    font-size: 1.75rem;
  }

  .hero-copy > p:last-child {
    display: none;
  }

  .form-container {
    padding-left: 1rem;
    padding-right: 1rem;
  }
}

@media (min-width: 768px) and (max-height: 760px) {
  .auth-page {
    place-items: start center;
    padding: 1rem 2rem;
  }
}

@media (max-width: 767px) {
  .auth-page {
    width: 100%;
    height: auto !important;
    min-height: 100vh !important;
    min-height: 100dvh !important;
    overflow: visible !important;
  }

  .auth-app {
    width: 100%;
    height: auto;
    min-height: 100vh;
    min-height: 100dvh;
    grid-template-rows: minmax(260px, 42svh) auto;
    overflow: visible;
  }

  .auth-hero {
    height: auto;
    min-height: 260px;
    padding:
      max(1rem, env(safe-area-inset-top))
      max(1rem, env(safe-area-inset-right))
      2.8rem
      max(1rem, env(safe-area-inset-left));
    background-position: 24% center;
  }

  .hero-top {
    align-items: flex-start;
    gap: 0.75rem;
  }

  .brand-logo {
    width: clamp(112px, 35vw, 142px);
    height: auto;
  }

  .brand-tagline {
    max-width: min(15rem, 48vw);
    font-size: clamp(0.5rem, 1.7vw, 0.62rem);
  }

  .passenger-chip {
    max-width: 48%;
    padding-inline: 0.6rem;
    font-size: clamp(0.56rem, 2.1vw, 0.68rem);
  }

  .hero-copy {
    display: block;
    left: max(1rem, env(safe-area-inset-left));
    right: max(1rem, env(safe-area-inset-right));
    bottom: 2.65rem;
  }

  .hero-copy h1 {
    font-size: clamp(1.8rem, 7.5vw, 2.5rem);
  }

  .auth-sheet {
    height: auto;
    min-height: 0;
    margin-top: -1.65rem;
    overflow: visible;
    border-radius: 1.8rem 1.8rem 0 0;
  }

  .sheet-handle {
    width: 42px;
    height: 4px;
    margin-top: 0.7rem;
  }

  .form-container {
    width: 100%;
    height: auto;
    max-width: 480px;
    display: block;
    overflow: visible;
    padding:
      1.2rem
      max(1.1rem, env(safe-area-inset-right))
      max(1.5rem, env(safe-area-inset-bottom))
      max(1.1rem, env(safe-area-inset-left));
  }

  .form-header {
    gap: 1rem;
  }

  .form-kicker {
    display: block;
    margin-bottom: 0.2rem;
    font-size: 0.78rem;
  }

  .form-header h2 {
    font-size: 1.65rem;
  }

  .header-icon {
    display: grid;
    width: 44px;
    height: 44px;
    border-radius: 14px;
  }

  .form-intro {
    display: block;
    margin-top: 0.6rem;
    font-size: 0.88rem;
    line-height: 1.55;
  }

  .auth-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: none;
    gap: 1.05rem;
    margin-top: 1.45rem;
  }

  .name-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1.05rem;
  }

  .first-name-field,
  .last-name-field,
  .username-field,
  .email-field,
  .contact-field,
  .password-field,
  .submit-action {
    grid-area: auto;
  }

  .auth-form > * {
    min-width: 0;
    margin: 0;
  }

  .auth-form :deep(label) {
    margin-bottom: 0.45rem;
    font-size: 0.82rem;
    line-height: 1.35;
  }

  .auth-form :deep(input) {
    width: 100%;
    height: auto;
    min-height: 52px;
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
    border-radius: 14px !important;
    font-size: 16px !important;
  }

  .auth-form :deep(input::placeholder) {
    font-size: inherit;
  }

  .auth-form :deep([data-slot="hint"]) {
    display: block;
  }

  .password-toggle {
    min-width: 44px;
    min-height: 44px;
    padding: 0 !important;
  }

  .primary-action {
    min-height: 54px;
    margin-top: 0.25rem;
    border-radius: 15px !important;
    font-size: 0.95rem;
  }

  .signin-row {
    flex: initial;
    gap: 0.35rem;
    margin-top: 1.15rem;
    font-size: 0.8rem;
    line-height: 1.4;
  }

  .pilot-note {
    flex: initial;
    display: flex;
    margin-top: 1.15rem;
    font-size: 0.7rem;
    line-height: 1.4;
  }
}

@media (min-width: 420px) and (max-width: 767px) {
  .name-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }
}

@media (min-width: 768px) {
  .auth-page {
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    padding: 1rem;
  }

  .auth-app {
    height: min(850px, 100%);
    min-height: 0;
  }

  .auth-hero {
    height: 100%;
    min-height: 0;
  }

  .auth-sheet {
    min-height: 0;
  }
}

@media (min-width: 768px) and (max-height: 800px) {
  .auth-page {
    padding: 0.5rem;
  }

  .form-container {
    padding: 1rem 1.25rem;
  }

  .form-brand {
    margin-bottom: 0.45rem;
  }

  .form-brand-logo {
    width: 118px;
  }

  .form-header h2 {
    font-size: 1.5rem;
  }

  .form-intro,
  .pilot-note {
    display: none;
  }

  .auth-form {
    gap: 0.55rem;
    margin-top: 0.65rem;
  }

  .auth-form :deep(label) {
    margin-bottom: 0.2rem;
  }

  .auth-form :deep(input) {
    min-height: 44px;
    padding-top: 0.45rem;
    padding-bottom: 0.45rem;
  }

  .primary-action {
    min-height: 44px;
    margin-top: 0;
  }

  .signin-row {
    margin-top: 0.65rem;
  }
}

@media (max-width: 767px) {
  .auth-page {
    height: 100dvh !important;
    min-height: 0 !important;
    overflow: hidden !important;
    display: grid;
    place-items: center;
    padding: 0.75rem;
  }

  .auth-app {
    width: min(100%, 500px);
    height: min(760px, 100%);
    min-height: 0;
    grid-template-rows: clamp(78px, 13vh, 104px) minmax(0, 1fr);
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.62);
    border-radius: 26px;
    box-shadow: 0 24px 70px rgba(10, 35, 21, 0.3);
  }

  .auth-hero {
    height: 100%;
    min-height: 0;
    padding:
      max(0.65rem, env(safe-area-inset-top))
      max(0.85rem, env(safe-area-inset-right))
      1rem
      max(0.85rem, env(safe-area-inset-left));
  }

  .hero-copy {
    display: none;
  }

  .passenger-chip {
    max-width: none;
    min-height: 30px;
    padding: 0.3rem 0.55rem;
    font-size: 0.68rem;
  }

  .auth-sheet {
    display: block;
    height: calc(100% + 0.7rem);
    min-height: 0;
    margin-top: -0.7rem;
    overflow: hidden;
    border-radius: 1.4rem;
  }

  .sheet-handle {
    width: 38px;
    height: 4px;
    margin-top: 0.45rem;
  }

  .form-container {
    width: 100%;
    height: calc(100% - 0.7rem);
    max-width: none;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
    padding:
      0.5rem
      max(0.85rem, env(safe-area-inset-right))
      max(0.45rem, env(safe-area-inset-bottom))
      max(0.85rem, env(safe-area-inset-left));
  }

  .form-brand {
    margin-bottom: 0.5rem;
  }

  .form-brand-logo {
    width: clamp(105px, 30vw, 132px);
  }

  .form-intro {
    display: none;
  }

  .form-header {
    gap: 0.5rem;
  }

  .form-kicker {
    margin-bottom: 0.02rem;
    font-size: 0.64rem;
  }

  .form-header h2 {
    font-size: clamp(1.15rem, 4.5vw, 1.4rem);
  }

  .header-icon {
    width: 34px;
    height: 34px;
    border-radius: 10px;
  }

  .auth-form {
    flex: 0 0 auto;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas:
      "first last"
      "username email"
      "contact password"
      "submit submit";
    gap: clamp(0.28rem, 1vh, 0.48rem) 0.5rem;
    margin-top: clamp(0.4rem, 1.1vh, 0.65rem);
  }

  .name-grid {
    display: contents;
  }

  .first-name-field { grid-area: first; }
  .last-name-field { grid-area: last; }
  .username-field { grid-area: username; }
  .email-field { grid-area: email; }
  .contact-field { grid-area: contact; }
  .password-field { grid-area: password; }
  .submit-action { grid-area: submit; }

  .auth-form > * {
    min-width: 0;
    margin: 0 !important;
  }

  .auth-form :deep(label) {
    margin-bottom: 0.12rem;
    font-size: clamp(0.62rem, 1.8vw, 0.72rem);
    line-height: 1.15;
  }

  .auth-form :deep(input) {
    width: 100%;
    height: clamp(38px, 5.7vh, 44px);
    min-height: clamp(38px, 5.7vh, 44px);
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
    border-radius: 11px !important;
    font-size: 16px !important;
  }

  .auth-form :deep([data-slot="hint"]) {
    display: none;
  }

  .password-toggle {
    min-width: 34px;
    min-height: 34px;
    padding: 0 !important;
  }

  .primary-action {
    min-height: clamp(40px, 6vh, 46px);
    margin-top: 0.08rem;
    border-radius: 12px !important;
    font-size: 0.82rem;
  }

  .signin-row {
    flex: 0 0 auto;
    gap: 0.25rem;
    margin-top: clamp(0.25rem, 0.8vh, 0.45rem);
    font-size: clamp(0.66rem, 1.9vw, 0.76rem);
    line-height: 1.2;
  }

  .pilot-note {
    flex: 0 0 auto;
    margin-top: clamp(0.18rem, 0.6vh, 0.35rem);
    font-size: clamp(0.56rem, 1.6vw, 0.66rem);
    line-height: 1.2;
  }
}

@media (max-height: 700px) and (max-width: 767px) {
  .auth-app {
    grid-template-rows: clamp(68px, 11vh, 88px) minmax(0, 1fr);
  }

  .form-container {
    padding-top: 0.3rem;
    padding-bottom: max(0.3rem, env(safe-area-inset-bottom));
  }

  .auth-form {
    gap: 0.2rem 0.4rem;
    margin-top: 0.3rem;
  }

  .auth-form :deep(input) {
    height: 36px;
    min-height: 36px;
  }

  .primary-action {
    min-height: 38px;
  }

  .pilot-note {
    display: none;
  }
}

@media (max-height: 580px) and (max-width: 767px) {
  .auth-app {
    grid-template-rows: 72px minmax(0, 1fr);
  }

  .form-brand-logo,
  .form-kicker,
  .header-icon {
    display: none;
  }

  .auth-form :deep(input) {
    height: 32px;
    min-height: 32px;
  }

  .primary-action {
    min-height: 34px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .primary-action {
    transition: none;
  }
}

.auth-app {
  display: block;
  width: min(100%, 560px);
  height: auto;
  min-height: 0;
  max-height: calc(100dvh - 2rem);
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.auth-sheet {
  width: 100%;
  height: auto;
  min-height: 0;
  max-height: inherit;
  margin: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 26px;
  background: linear-gradient(145deg, rgba(246, 251, 241, 0.58), rgba(232, 243, 226, 0.45));
  backdrop-filter: blur(16px) saturate(130%);
  -webkit-backdrop-filter: blur(16px) saturate(130%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.88),
    0 24px 70px rgba(10, 35, 21, 0.3);
}

.form-container {
  width: 100%;
  height: auto;
  max-height: inherit;
  max-width: none;
  margin: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: visible;
  padding: clamp(1rem, 3vw, 2rem);
}

.form-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin: 0 auto 0.85rem;
  gap: 0.4rem;
  text-align: center;
}

.form-brand-logo {
  width: clamp(176px, 52vw, 220px);
}

.brand-meaning {
  max-width: 19rem;
  color: #4d6252;
  font-size: 0.76rem;
  font-weight: 600;
  line-height: 1.3;
}

@media (max-width: 767px) {
  .auth-app {
    width: min(100%, 500px);
    max-height: calc(100dvh - 1.5rem);
  }

  .form-container {
    padding: 1rem;
  }

  .form-brand {
    margin-bottom: 0.55rem;
  }

  .form-brand-logo {
    width: clamp(156px, 48vw, 190px);
  }

  .brand-meaning {
    max-width: 18rem;
    font-size: 0.66rem;
  }

  .auth-app--register .form-header h2 {
    font-size: clamp(1.05rem, 4.4vw, 1.3rem);
  }
}

@media (max-height: 600px) {
  .form-brand {
    margin-bottom: 0.3rem;
    gap: 0.2rem;
  }

  .form-brand-logo {
    width: 142px;
  }

  .brand-meaning {
    font-size: 0.6rem;
  }
}

.auth-page {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  place-items: center;
  overflow: hidden;
  padding: 1rem;
  box-sizing: border-box;
}

.auth-app {
  width: min(100%, 460px);
  max-height: calc(100dvh - 2rem);
}

.auth-sheet {
  max-height: calc(100dvh - 2rem);
}

.form-container {
  padding: clamp(0.9rem, 2.5vw, 1.4rem);
}

.form-brand {
  margin-bottom: 0.6rem;
  gap: 0.28rem;
}

.form-brand-logo {
  width: clamp(164px, 42vw, 190px);
}

.brand-meaning {
  font-size: 0.68rem;
}

.auth-app--register .form-header {
  justify-content: center;
  text-align: center;
}

.auth-app--register .header-icon {
  display: none;
}

.auth-app--register .form-intro {
  display: none;
}

.auth-app--register .auth-form {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-areas:
    "first last"
    "username username"
    "email email"
    "contact password"
    "submit submit";
  gap: 0.5rem 0.6rem;
  margin-top: 0.7rem;
}

.auth-app--register .name-grid {
  display: contents;
}

.auth-app--register .first-name-field {
  grid-area: first;
}

.auth-app--register .last-name-field {
  grid-area: last;
}

.auth-app--register .username-field {
  grid-area: username;
}

.auth-app--register .email-field {
  grid-area: email;
}

.auth-app--register .contact-field {
  grid-area: contact;
}

.auth-app--register .password-field {
  grid-area: password;
}

.auth-app--register .submit-action {
  grid-area: submit;
}

.auth-app--register .auth-form > * {
  min-width: 0;
  margin: 0 !important;
}

.auth-app--register .auth-form :deep(label) {
  position: absolute !important;
  width: 1px;
  height: 1px;
  margin: -1px !important;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.auth-app--register .auth-form input {
  min-height: 44px !important;
  border-radius: 12px !important;
}

.auth-app--register .auth-form [data-slot='hint'] {
  display: none;
}

.auth-app--register .primary-action {
  min-height: 44px;
  margin-top: 0.1rem;
}

.auth-app--register .signin-row {
  margin-top: 0.65rem;
  font-size: 0.74rem;
}

@media (max-width: 767px) {
  .auth-page {
    padding: 0.75rem;
  }

  .auth-app,
  .auth-sheet {
    max-height: calc(100dvh - 1.5rem);
  }

  .auth-app--register .form-container {
    padding: 0.85rem;
  }

  .auth-app--register .form-brand {
    margin-bottom: 0.45rem;
  }

  .auth-app--register .form-brand-logo {
    width: clamp(150px, 43vw, 176px);
  }

  .auth-app--register .brand-meaning {
    font-size: 0.62rem;
  }

  .auth-app--register .form-header h2 {
    font-size: clamp(1.08rem, 4.3vw, 1.3rem);
  }

  .auth-app--register .auth-form {
    gap: 0.4rem 0.5rem;
    margin-top: 0.55rem;
  }

  .auth-app--register .auth-form input {
    min-height: 40px !important;
    padding-inline: 0.55rem;
  }

  .auth-app--register .password-toggle {
    min-width: 30px;
    min-height: 30px;
  }

  .auth-app--register .primary-action {
    min-height: 40px;
  }
}

@media (max-height: 600px) {
  .auth-page {
    padding: 0.5rem;
  }

  .auth-app,
  .auth-sheet {
    max-height: calc(100dvh - 1rem);
  }

  .auth-app--register .form-container {
    padding: 0.5rem 0.8rem;
  }

  .auth-app--register .form-brand {
    margin-bottom: 0.25rem;
    gap: 0.1rem;
  }

  .auth-app--register .form-brand-logo {
    width: 130px;
  }

  .auth-app--register .brand-meaning {
    font-size: 0.56rem;
    line-height: 1.1;
  }

  .auth-app--register .form-header h2 {
    font-size: 1.1rem;
  }

  .auth-app--register .auth-form {
    gap: 0.25rem 0.4rem;
    margin-top: 0.35rem;
  }

  .auth-app--register .auth-form input,
  .auth-app--register .primary-action {
    min-height: 34px !important;
  }

  .auth-app--register .signin-row {
    margin-top: 0.35rem;
    font-size: 0.66rem;
  }
}

.auth-app--register .form-brand-logo {
  width: clamp(170px, 48vw, 205px);
}

@media (max-width: 767px) {
  .auth-app--register .form-brand-logo {
    width: clamp(168px, 54vw, 202px);
  }
}

@media (max-height: 600px) {
  .auth-app--register .form-brand-logo {
    width: 140px;
  }
}

.auth-page {
  background:
    radial-gradient(ellipse at 8% 12%, rgb(190 232 156 / 56%), transparent 34%),
    radial-gradient(ellipse at 94% 88%, rgb(186 226 196 / 48%), transparent 38%),
    radial-gradient(ellipse at 78% 14%, rgb(226 244 213 / 72%), transparent 30%),
    linear-gradient(135deg, #f7fbf4 0%, #edf6e9 48%, #f8fbf6 100%);
}

.auth-sheet {
  position: relative;
  isolation: isolate;
  border-color: rgb(255 255 255 / 72%);
  background: linear-gradient(145deg, rgb(255 255 255 / 78%), rgb(239 248 232 / 70%) 48%, rgb(225 241 223 / 68%));
  backdrop-filter: blur(26px) saturate(155%);
  -webkit-backdrop-filter: blur(26px) saturate(155%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 92%),
    inset 0 -1px 0 rgb(255 255 255 / 24%),
    0 30px 90px -38px rgb(5 25 16 / 68%);
}

.auth-sheet::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(ellipse at 12% 0%, rgb(255 255 255 / 66%), transparent 46%),
    linear-gradient(145deg, rgb(255 255 255 / 14%), transparent 55%);
  content: '';
  pointer-events: none;
}

.form-container {
  position: relative;
  z-index: 1;
}

.form-header h2 {
  color: #183327;
}

.primary-action {
  background: linear-gradient(110deg, #c5ea86, #a9db65) !important;
  box-shadow: 0 12px 26px rgb(63 98 18 / 20%);
}

.primary-action:hover:not(:disabled) {
  background: linear-gradient(110deg, #d2f09f, #b7e47a) !important;
  box-shadow: 0 15px 30px rgb(63 98 18 / 26%);
}
</style>
