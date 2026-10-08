<script setup lang="ts">
// @ts-nocheck

import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: false,
  middleware: ['guest']
})

useHead({
  title: 'Login | PAMANA'
})

const {
  login,
  redirectByRole,
  loading
} = useAuth()

const toast = useToast()
const showPassword = ref(false)

const schema = z.object({
  identifier: z
    .string()
    .min(1, 'Email or username is required'),

  password: z
    .string()
    .min(1, 'Password is required')
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  identifier: '',
  password: ''
})

const getLoginErrorMessage = (error: any) => {
  const responseData = error?.data ?? error?.response?._data ?? error?.response?.data
  const message =
    responseData?.error?.message ||
    responseData?.message ||
    error?.statusMessage ||
    error?.message
  const status =
    error?.status ??
    error?.statusCode ??
    error?.response?.status ??
    responseData?.error?.status

  if (
    message === 'Invalid identifier or password' ||
    status === 400
  ) {
    return 'Invalid email, username, or password.'
  }

  return 'Unable to sign in. Please try again.'
}

const onSubmit = async (
  event: FormSubmitEvent<Schema>
) => {
  try {
    await login(event.data)

    toast.add({
      title: 'Login successful',
      description: 'Welcome to PAMANA.',
      color: 'success'
    })

    await redirectByRole()
  } catch (error) {
    console.error('Login error:', error)

    toast.add({
      title: 'Login failed',
      description: getLoginErrorMessage(error),
      color: 'error'
    })
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-app auth-app--login">
      <div class="auth-sheet">
        <div class="form-container">
          <div class="form-brand">
            <img
              src="/pamana-logo.png"
              alt="PAMANA"
              class="form-brand-logo"
            >
            <span class="brand-meaning">Pampanga AI-powered Mobility Access and Navigation Assistant</span>
          </div>

          <header class="form-header">
            <div>
              <p class="form-kicker">Welcome back</p>
              <h2>Sign in to PAMANA</h2>
            </div>

            <div class="header-icon" aria-hidden="true">
              <UIcon name="i-lucide-log-in" class="size-5" />
            </div>
          </header>

          <UForm
            :schema="schema"
            :state="state"
            class="auth-form"
            @submit="onSubmit"
          >
            <UFormField
              label="Email or username"
              name="identifier"
              required
            >
              <UInput
                v-model="state.identifier"
                placeholder="Enter your email or username"
                icon="i-lucide-user-round"
                autocomplete="username"
                color="neutral"
                variant="outline"
                size="xl"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="Password"
              name="password"
              required
            >
              <UInput
                v-model="state.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Enter your password"
                icon="i-lucide-lock-keyhole"
                autocomplete="current-password"
                color="neutral"
                variant="outline"
                size="xl"
                class="w-full"
              >
                <template #trailing>
                  <UButton
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

            <UButton
              type="submit"
              block
              size="xl"
              :loading="loading"
              :disabled="loading"
              class="primary-action"
            >
              <span>Sign in</span>
              <UIcon
                v-if="!loading"
                name="i-lucide-arrow-right"
                class="size-5"
              />
            </UButton>
          </UForm>

          <div class="signin-row">
            <span>New to PAMANA?</span>
            <NuxtLink to="/register">
              Create an account
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
:global(html),
:global(body) {
  background: #f3f6f1;
}

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
    linear-gradient(180deg, rgba(4, 22, 17, 0.32), rgba(4, 22, 17, 0.72)),
    linear-gradient(110deg, rgba(7, 46, 35, 0.55), rgba(7, 46, 35, 0.05));
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
  align-items: center;
}

.brand-logo {
  width: 142px;
  height: auto;
  object-fit: contain;
  filter:
    drop-shadow(0 1px 0 rgba(255, 255, 255, 0.65))
    drop-shadow(0 4px 12px rgba(0, 0, 0, 0.18));
}

.secure-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 36px;
  padding: 0.45rem 0.7rem;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 999px;
  color: #fff;
  background: rgba(8, 38, 30, 0.44);
  backdrop-filter: blur(12px);
  font-size: 0.72rem;
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
  transform: translateY(-1px);
  box-shadow: 0 15px 30px rgba(101, 163, 13, 0.27);
}

.primary-action:active:not(:disabled) {
  transform: translateY(0);
}

.primary-action:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1.5rem 0 1rem;
  color: #8a938b;
}

.divider span {
  height: 1px;
  flex: 1;
  background: #e5e9e4;
}

.divider p {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 650;
  white-space: nowrap;
}

.secondary-action {
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid #e1e6df;
  border-radius: 16px;
  color: #2d382f;
  background: #fff;
  text-decoration: none;
  box-shadow: 0 7px 18px rgba(18, 44, 27, 0.05);
  transition:
    border-color 160ms ease,
    background 160ms ease,
    transform 160ms ease;
}

.secondary-action:hover {
  border-color: #b7d88d;
  background: #fbfef7;
  transform: translateY(-1px);
}

.secondary-icon {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 13px;
  color: #4d7c0f;
  background: #f1f9df;
}

.secondary-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.secondary-copy strong {
  font-size: 0.87rem;
  font-weight: 780;
}

.secondary-copy small {
  color: #7a837b;
  font-size: 0.72rem;
}

.chevron {
  flex: 0 0 auto;
  color: #9ca49d;
}

.pilot-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  margin-top: 1.15rem;
  color: #758078;
  font-size: 0.7rem;
  line-height: 1.4;
  text-align: center;
}

/* Very small phones */
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

  .secure-chip {
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

/* Desktop / large tablet */
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
}

@media (max-width: 767px) {
  .auth-page {
    width: 100%;
    height: 100vh;
    height: 100dvh;
    min-height: 0;
    overflow: hidden;
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
    min-height: 0;
    padding:
      max(0.65rem, env(safe-area-inset-top))
      max(0.85rem, env(safe-area-inset-right))
      1rem
      max(0.85rem, env(safe-area-inset-left));
    background-position: 24% center;
  }

  .hero-top {
    gap: 0.5rem;
  }

  .hero-copy {
    display: none;
  }

  .secure-chip {
    min-height: 30px;
    padding: 0.3rem 0.55rem;
    font-size: 0.68rem;
  }

  .auth-sheet {
    min-width: 0;
    height: calc(100% + 0.7rem);
    margin-top: -0.7rem;
    overflow: hidden;
    border-radius: 1.4rem;
  }

  .form-container {
    height: calc(100% - 0.7rem);
    max-width: 480px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
    padding:
      0.6rem
      max(1rem, env(safe-area-inset-right))
      max(0.5rem, env(safe-area-inset-bottom))
      max(1rem, env(safe-area-inset-left));
  }

  .form-brand {
    margin-bottom: 0.5rem;
  }

  .form-brand-logo {
    width: clamp(105px, 30vw, 132px);
  }

  .form-header h2 {
    font-size: clamp(1.3rem, 5vw, 1.65rem);
  }

  .header-icon {
    width: 36px;
    height: 36px;
  }

  .form-intro {
    display: none;
  }

  .auth-form {
    gap: 0.65rem;
    margin-top: 0.8rem;
  }

  .auth-form :deep(label) {
    margin-bottom: 0.2rem;
  }

  .auth-form :deep(input) {
    min-height: 46px;
  }

  .primary-action {
    min-height: 46px;
    margin-top: 0.05rem;
  }

  .divider {
    gap: 0.5rem;
    margin: 0.85rem 0 0.65rem;
  }

  .secondary-action {
    min-height: 54px;
    padding: 0.4rem 0.65rem;
  }

  .secondary-icon {
    width: 36px;
    height: 36px;
  }

  .pilot-note {
    margin-top: 0.65rem;
  }

  .auth-form > * {
    min-width: 0;
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

  .form-container {
    padding: clamp(1.25rem, 3vw, 3rem);
  }
}

@media (max-height: 600px) and (max-width: 767px) {
  .auth-app {
    grid-template-rows: 68px minmax(0, 1fr);
  }

  .form-brand {
    margin-bottom: 0.35rem;
  }

  .form-brand-logo {
    display: none;
  }

  .header-icon,
  .pilot-note {
    display: none;
  }

  .auth-form {
    gap: 0.45rem;
    margin-top: 0.5rem;
  }

  .auth-form :deep(input),
  .primary-action {
    min-height: 40px;
  }

  .divider {
    margin: 0.5rem 0 0.4rem;
  }

  .secondary-action {
    min-height: 46px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .primary-action,
  .secondary-action {
    transition: none;
  }
}

.auth-app {
  display: block;
  width: min(100%, 440px);
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
  margin: 0 auto 1.1rem;
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

.auth-app--login .header-icon {
  display: none;
}

@media (max-width: 767px) {
  .auth-app {
    width: min(100%, 440px);
    max-height: calc(100dvh - 1.5rem);
  }

  .form-container {
    padding: 1.15rem;
  }

  .form-brand {
    margin-bottom: 0.75rem;
  }

  .form-brand-logo {
    width: clamp(168px, 54vw, 202px);
  }

  .brand-meaning {
    max-width: 18rem;
    font-size: 0.68rem;
  }
}

@media (max-height: 600px) {
  .form-brand {
    margin-bottom: 0.4rem;
  }

  .form-brand-logo {
    width: 156px;
  }

  .brand-meaning {
    font-size: 0.62rem;
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
  width: min(100%, 430px);
  max-height: calc(100dvh - 2rem);
}

.auth-sheet {
  max-height: calc(100dvh - 2rem);
}

.form-container {
  padding: clamp(1rem, 3vw, 1.65rem);
}

.form-brand {
  margin-bottom: 0.75rem;
}

.form-brand-logo {
  width: clamp(170px, 48vw, 205px);
}

.brand-meaning {
  font-size: 0.7rem;
}

.auth-app--login .form-header {
  justify-content: center;
  text-align: center;
}

.auth-app--login .form-kicker {
  margin-bottom: 0.25rem;
}

.auth-app--login .auth-form {
  gap: 0.7rem;
  margin-top: 1rem;
}

.auth-app--login .auth-form :deep(label) {
  position: absolute !important;
  width: 1px;
  height: 1px;
  margin: -1px !important;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.auth-app--login .auth-form input {
  min-height: 46px !important;
}

.auth-app--login .primary-action {
  min-height: 46px;
  margin-top: 0.15rem;
}

.signin-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.9rem;
  color: #5e7163;
  font-size: 0.78rem;
}

.signin-row a {
  color: #28723b;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 2px;
}

@media (max-width: 767px) {
  .auth-page {
    padding: 0.75rem;
  }

  .auth-app,
  .auth-sheet {
    max-height: calc(100dvh - 1.5rem);
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

  .form-container {
    padding: 0.65rem 1rem;
  }

  .form-brand {
    margin-bottom: 0.35rem;
    gap: 0.15rem;
  }

  .form-brand-logo {
    width: 140px;
  }

  .brand-meaning {
    font-size: 0.58rem;
    line-height: 1.15;
  }

  .auth-app--login .form-header h2 {
    font-size: 1.25rem;
  }

  .auth-app--login .auth-form {
    gap: 0.4rem;
    margin-top: 0.55rem;
  }

  .auth-app--login .auth-form input,
  .auth-app--login .primary-action {
    min-height: 36px !important;
  }

  .signin-row {
    margin-top: 0.45rem;
    font-size: 0.68rem;
  }
}

.auth-app--login .form-brand-logo {
  width: clamp(170px, 48vw, 205px);
}

@media (max-width: 767px) {
  .auth-app--login .form-brand-logo {
    width: clamp(168px, 54vw, 202px);
  }
}

@media (max-height: 600px) {
  .auth-app--login .form-brand-logo {
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
