<script setup lang="ts">
definePageMeta({ layout: false })
useHead({
  title: 'PAMANA | Mobility made clearer',
  meta: [{ name: 'description', content: 'Plan a clearer journey around Pampanga with PAMANA, the AI-powered mobility access and navigation assistant.' }]
})
const { initialized, isAuthenticated, restoreSession, getRoleHomeRoute } = useAuth()
const sessionReady = ref(false)
onMounted(async () => {
  if (!initialized.value) await restoreSession()
  if (isAuthenticated.value) {
    await navigateTo(getRoleHomeRoute())
    return
  }
  sessionReady.value = true
})
</script>

<template>
  <main v-if="sessionReady" class="landing-page">
    <section class="landing-hero">
      <header class="landing-header">
        <NuxtLink to="/" class="landing-brand" aria-label="PAMANA home">
          <img src="/pamana-logo.png" alt="PAMANA" class="landing-logo">
          <span class="landing-brand-copy">Mobility for Pampanga</span>
        </NuxtLink>

        <nav class="landing-nav" aria-label="Main navigation">
          <a href="#how-it-helps">How it helps</a>
          <NuxtLink to="/login" class="landing-login">Sign in</NuxtLink>
          <NuxtLink to="/register" class="landing-nav-cta">Create account</NuxtLink>
        </nav>
      </header>

      <div class="landing-hero-content">
        <div class="landing-copy">
          <span class="landing-eyebrow">
            <span class="landing-eyebrow-dot" />
            Pampanga mobility, made clearer
          </span>

          <h1>Everyday journeys.<br><span>Made easier to plan.</span></h1>

          <p class="landing-description">
            Find your way around Pampanga with a mobility assistant designed to make local travel easier to understand and navigate.
          </p>

          <div class="landing-actions">
            <NuxtLink to="/register" class="landing-primary">
              Get started
              <UIcon name="i-lucide-arrow-up-right" class="size-4" />
            </NuxtLink>
            <NuxtLink to="/login" class="landing-secondary">
              Sign in to PAMANA
              <UIcon name="i-lucide-arrow-right" class="size-4" />
            </NuxtLink>
          </div>

          <div class="landing-proof">
            <span class="landing-proof-icon">
              <UIcon name="i-lucide-map-pin" class="size-4" />
            </span>
            <span>Built around the places and journeys of Pampanga</span>
          </div>
        </div>

        <aside class="landing-highlight" aria-label="About PAMANA">
          <div class="highlight-topline">
            <span class="highlight-mark"><UIcon name="i-lucide-navigation" class="size-5" /></span>
            <span class="highlight-caption">YOUR MOBILITY COMPANION</span>
          </div>

          <p class="highlight-title">A little more clarity<br>for the road ahead.</p>
          <p class="highlight-description">
            One place to explore trip options, see transport information, and make more informed travel choices.
          </p>

          <div class="highlight-route" aria-hidden="true">
            <span class="route-stop route-stop--start" />
            <span class="route-line" />
            <span class="route-stop route-stop--end" />
            <span class="route-label route-label--start">Your starting point</span>
            <span class="route-label route-label--end">Where you want to go</span>
          </div>

          <div class="highlight-footer">
            <span><UIcon name="i-lucide-sparkles" class="size-4" /> Thoughtful local mobility</span>
            <UIcon name="i-lucide-arrow-up-right" class="size-4" />
          </div>
        </aside>
      </div>

      <div class="landing-scroll-cue" aria-hidden="true">
        <span />
        Explore PAMANA
      </div>
    </section>

    <section id="how-it-helps" class="landing-features">
      <div class="features-heading">
        <div>
          <span class="section-eyebrow">A clearer way to move</span>
          <h2>Made for real-world journeys.</h2>
        </div>
        <p>
          PAMANA brings useful mobility tools together in one welcoming place, with Pampanga and its communities at the heart of the experience.
        </p>
      </div>

      <div class="feature-grid">
        <article class="feature-card">
          <span class="feature-icon feature-icon--lime"><UIcon name="i-lucide-route" class="size-5" /></span>
          <span class="feature-number">01 / PLAN</span>
          <h3>Explore trip options</h3>
          <p>Set your pickup point and destination to see supported journey options in one place.</p>
        </article>

        <article class="feature-card">
          <span class="feature-icon feature-icon--teal"><UIcon name="i-lucide-map" class="size-5" /></span>
          <span class="feature-number">02 / NAVIGATE</span>
          <h3>See the bigger picture</h3>
          <p>Use maps and transport details to better understand where your trip can take you.</p>
        </article>

        <article class="feature-card">
          <span class="feature-icon feature-icon--gold"><UIcon name="i-lucide-accessibility" class="size-5" /></span>
          <span class="feature-number">03 / ACCESS</span>
          <h3>Designed for different needs</h3>
          <p>Choose a passenger fare category and explore a travel experience built with access in mind.</p>
        </article>
      </div>

      <footer class="landing-footer">
        <NuxtLink to="/" class="footer-brand">
          <img src="/pamana-logo.png" alt="" class="footer-logo">
          <span>Pampanga AI-powered Mobility Access and Navigation Assistant</span>
        </NuxtLink>
        <div class="footer-links">
          <NuxtLink to="/login">Sign in</NuxtLink>
          <NuxtLink to="/register">Create account</NuxtLink>
        </div>
      </footer>
    </section>
  </main>
  <div v-else class="flex min-h-screen items-center justify-center" role="status">Loading PAMANA…</div>
</template>

<style scoped>
.landing-page {
  --landing-ink: #183327;
  --landing-muted: #53665b;
  --landing-green: #365f35;
  min-height: 100vh;
  color: var(--landing-ink);
  background: #f5f7f2;
}

.landing-hero {
  position: relative;
  display: flex;
  min-height: min(790px, 100svh);
  flex-direction: column;
  overflow: hidden;
  color: #fff;
  background:
    linear-gradient(90deg, rgb(11 34 25 / 83%) 0%, rgb(14 42 29 / 67%) 48%, rgb(16 48 34 / 26%) 100%),
    linear-gradient(0deg, rgb(8 28 23 / 24%), transparent 56%),
    url('/pamana-login-bg.png') center 48% / cover no-repeat,
    #153b2d;
}

.landing-hero::after {
  position: absolute;
  right: -12rem;
  bottom: -25rem;
  width: 52rem;
  height: 52rem;
  border: 1px solid rgb(222 255 196 / 14%);
  border-radius: 50%;
  content: '';
  pointer-events: none;
}

.landing-header,
.landing-hero-content,
.landing-scroll-cue {
  position: relative;
  z-index: 1;
}

.landing-header {
  display: flex;
  width: min(100% - 3rem, 1240px);
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  margin: 0 auto;
  padding: 1.35rem 0;
  border-bottom: 1px solid rgb(255 255 255 / 17%);
}

.landing-brand {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.8rem;
  text-decoration: none;
}

.landing-logo {
  display: block;
  width: 118px;
  height: 45px;
  object-fit: contain;
  object-position: left center;
  filter: brightness(0) invert(1);
}

.landing-brand-copy {
  padding-left: 0.8rem;
  border-left: 1px solid rgb(255 255 255 / 28%);
  color: rgb(255 255 255 / 76%);
  font-size: 0.72rem;
  letter-spacing: 0.02em;
}

.landing-nav,
.landing-actions,
.footer-links {
  display: flex;
  align-items: center;
}

.landing-nav {
  gap: clamp(1rem, 3vw, 2.4rem);
  font-size: 0.84rem;
  font-weight: 600;
}

.landing-nav a,
.footer-links a {
  color: inherit;
  text-decoration: none;
}

.landing-nav a:hover,
.footer-links a:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
}

.landing-nav-cta {
  padding: 0.7rem 1.05rem;
  border: 1px solid rgb(255 255 255 / 42%);
  border-radius: 999px;
  background: rgb(255 255 255 / 10%);
  backdrop-filter: blur(12px);
}

.landing-hero-content {
  display: grid;
  width: min(100% - 3rem, 1160px);
  flex: 1;
  grid-template-columns: minmax(0, 1.3fr) minmax(300px, 0.7fr);
  align-items: center;
  gap: clamp(2rem, 8vw, 7rem);
  margin: 0 auto;
  padding: clamp(3.5rem, 9vh, 6.5rem) 0;
}

.landing-copy {
  max-width: 690px;
}

.landing-eyebrow,
.landing-proof,
.highlight-footer span,
.highlight-footer {
  display: flex;
  align-items: center;
}

.landing-eyebrow {
  gap: 0.6rem;
  color: #d8efc6;
  font-size: 0.77rem;
  font-weight: 700;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.landing-eyebrow-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #b8e779;
  box-shadow: 0 0 0 5px rgb(184 231 121 / 16%);
}

.landing-copy h1 {
  margin: 1.35rem 0 1rem;
  font-family: var(--font-display);
  font-size: clamp(2.8rem, 6vw, 5.5rem);
  font-weight: 600;
  letter-spacing: -0.065em;
  line-height: 0.99;
}

.landing-copy h1 span {
  color: #c3e59a;
}

.landing-description {
  max-width: 560px;
  color: rgb(255 255 255 / 80%);
  font-size: clamp(1rem, 1.5vw, 1.12rem);
  line-height: 1.75;
}

.landing-actions {
  flex-wrap: wrap;
  gap: 0.8rem;
  margin-top: 2rem;
}

.landing-primary,
.landing-secondary {
  display: inline-flex;
  min-height: 49px;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  border-radius: 999px;
  padding: 0.8rem 1.25rem;
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;
  transition: transform 160ms ease, background-color 160ms ease, border-color 160ms ease;
}

.landing-primary {
  color: #1d321d;
  background: #c5ea86;
  box-shadow: 0 14px 28px -18px rgb(3 18 9 / 70%);
}

.landing-primary:hover {
  transform: translateY(-2px);
  background: #d4f1a3;
}

.landing-secondary {
  border: 1px solid rgb(255 255 255 / 30%);
  color: #fff;
  background: rgb(255 255 255 / 8%);
}

.landing-secondary:hover {
  border-color: rgb(255 255 255 / 65%);
  background: rgb(255 255 255 / 15%);
}

.landing-proof {
  gap: 0.65rem;
  margin-top: 2.5rem;
  color: rgb(255 255 255 / 72%);
  font-size: 0.78rem;
}

.landing-proof-icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 50%;
  color: #d2edb3;
  background: rgb(255 255 255 / 8%);
}

.landing-highlight {
  position: relative;
  max-width: 360px;
  justify-self: end;
  border: 1px solid rgb(255 255 255 / 32%);
  border-radius: 1.6rem;
  padding: clamp(1.3rem, 3vw, 1.8rem);
  background: linear-gradient(145deg, rgb(248 255 240 / 91%), rgb(231 245 224 / 82%));
  box-shadow: 0 34px 80px -42px rgb(0 0 0 / 70%);
  color: #21392c;
  backdrop-filter: blur(20px);
}

.highlight-topline {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.highlight-mark {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 13px;
  color: #315d32;
  background: #dcefbd;
}

.highlight-caption {
  color: #5f775e;
  font-size: 0.63rem;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.highlight-title {
  margin: 1.45rem 0 0.55rem;
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 2.5vw, 1.9rem);
  font-weight: 600;
  letter-spacing: -0.045em;
  line-height: 1.13;
}

.highlight-description {
  color: #586b5b;
  font-size: 0.83rem;
  line-height: 1.7;
}

.highlight-route {
  position: relative;
  display: grid;
  min-height: 86px;
  grid-template-columns: 15px 1fr;
  align-items: center;
  column-gap: 0.75rem;
  margin: 1.4rem 0;
  padding: 0.25rem 0.4rem;
}

.route-stop {
  z-index: 1;
  width: 12px;
  height: 12px;
  grid-column: 1;
  border: 3px solid #f3f8eb;
  border-radius: 50%;
  background: #5e913e;
  box-shadow: 0 0 0 1px #75a955;
}

.route-stop--end {
  background: #338a80;
  box-shadow: 0 0 0 1px #5eaaa0;
}

.route-line {
  position: absolute;
  top: 20px;
  bottom: 20px;
  left: 9px;
  border-left: 2px dashed #9ab18e;
}

.route-label {
  color: #687b6b;
  font-size: 0.72rem;
}

.route-label--start {
  grid-column: 2;
  grid-row: 1;
}

.route-label--end {
  grid-column: 2;
  grid-row: 2;
}

.highlight-footer {
  justify-content: space-between;
  border-top: 1px solid rgb(49 83 53 / 12%);
  padding-top: 1rem;
  color: #477249;
}

.highlight-footer span {
  gap: 0.45rem;
  font-size: 0.73rem;
  font-weight: 700;
}

.landing-scroll-cue {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: min(100% - 3rem, 1160px);
  margin: 0 auto;
  padding: 0 0 1.6rem;
  color: rgb(255 255 255 / 63%);
  font-size: 0.67rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.landing-scroll-cue span {
  width: 32px;
  height: 1px;
  background: #c5e98f;
}

.landing-features {
  width: min(100% - 3rem, 1160px);
  margin: 0 auto;
  padding: clamp(3.5rem, 8vw, 6.5rem) 0 1.5rem;
}

.features-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 2rem;
  margin-bottom: 2rem;
}

.section-eyebrow {
  color: #61894a;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.features-heading h2 {
  margin: 0.55rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  font-weight: 600;
  letter-spacing: -0.055em;
  line-height: 1.08;
}

.features-heading > p {
  max-width: 440px;
  margin: 0;
  color: var(--landing-muted);
  font-size: 0.88rem;
  line-height: 1.7;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.feature-card {
  min-height: 230px;
  border: 1px solid rgb(53 85 55 / 12%);
  border-radius: 1.4rem;
  padding: 1.35rem;
  background: rgb(255 255 255 / 76%);
  box-shadow: 0 16px 42px -32px rgb(24 51 39 / 36%);
}

.feature-icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 14px;
}

.feature-icon--lime {
  color: #50752c;
  background: #e5f2d1;
}

.feature-icon--teal {
  color: #26746c;
  background: #d9efeb;
}

.feature-icon--gold {
  color: #8a6a29;
  background: #f4ebd2;
}

.feature-number {
  display: block;
  margin-top: 1.35rem;
  color: #78877c;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.feature-card h3 {
  margin: 0.45rem 0;
  font-family: var(--font-display);
  font-size: 1.16rem;
  font-weight: 600;
  letter-spacing: -0.035em;
}

.feature-card p {
  margin: 0;
  color: var(--landing-muted);
  font-size: 0.82rem;
  line-height: 1.7;
}

.landing-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  margin-top: clamp(3rem, 7vw, 5.5rem);
  border-top: 1px solid rgb(53 85 55 / 14%);
  padding: 1.2rem 0;
}

.footer-brand {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.75rem;
  color: #65756a;
  font-size: 0.68rem;
  text-decoration: none;
}

.footer-logo {
  width: 82px;
  height: 32px;
  object-fit: contain;
}

.footer-links {
  flex-shrink: 0;
  gap: 1.2rem;
  color: #405d46;
  font-size: 0.75rem;
  font-weight: 700;
}

@media (max-width: 760px) {
  .landing-hero {
    height: 100svh;
    min-height: 100svh;
    background-position: 57% center;
  }

  .landing-header,
  .landing-hero-content,
  .landing-scroll-cue,
  .landing-features {
    width: min(100% - 2rem, 560px);
  }

  .landing-header {
    padding: 0.85rem 0;
  }

  .landing-logo {
    width: 94px;
    height: 38px;
  }

  .landing-brand-copy {
    display: none;
  }

  .landing-nav {
    gap: 0.9rem;
    font-size: 0.76rem;
  }

  .landing-nav > a:first-child {
    display: none;
  }

  .landing-nav-cta {
    padding: 0.6rem 0.8rem;
  }

  .landing-hero-content {
    grid-template-columns: 1fr;
    align-content: center;
    gap: 0;
    padding: 1.5rem 0;
  }

  .landing-copy h1 {
    margin-top: 1.1rem;
    font-size: clamp(2.8rem, 12vw, 4.3rem);
  }

  .landing-description {
    max-width: 34rem;
    font-size: 0.95rem;
  }

  .landing-actions {
    gap: 0.65rem;
    margin-top: 1.4rem;
  }

  .landing-primary,
  .landing-secondary {
    min-height: 46px;
    padding: 0.7rem 0.95rem;
    font-size: 0.8rem;
  }

  .landing-proof {
    margin-top: 1.4rem;
    font-size: 0.7rem;
  }

  .landing-highlight {
    display: none;
  }

  .landing-scroll-cue {
    display: none;
  }

  .landing-features {
    display: none;
  }

  .features-heading {
    display: block;
  }

  .features-heading > p {
    margin-top: 0.9rem;
  }

  .feature-grid {
    grid-template-columns: 1fr;
  }

  .feature-card {
    min-height: 0;
    padding: 1.1rem;
  }

  .feature-number {
    margin-top: 1rem;
  }
}

@media (max-width: 760px) and (max-height: 700px) {
  .landing-header {
    padding: 0.55rem 0;
  }

  .landing-hero-content {
    padding: 0.75rem 0;
  }

  .landing-copy h1 {
    margin: 0.9rem 0 0.65rem;
    font-size: clamp(2.35rem, 10vw, 3.4rem);
  }

  .landing-description {
    font-size: 0.85rem;
    line-height: 1.55;
  }

  .landing-proof {
    display: none;
  }
}

@media (max-width: 420px) {
  .landing-header,
  .landing-hero-content,
  .landing-scroll-cue,
  .landing-features {
    width: min(100% - 1.5rem, 560px);
  }

  .landing-nav {
    gap: 0.65rem;
    font-size: 0.72rem;
  }

  .landing-nav-cta {
    padding: 0.55rem 0.7rem;
  }

  .landing-eyebrow {
    font-size: 0.62rem;
    letter-spacing: 0.1em;
  }

  .landing-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .landing-primary,
  .landing-secondary {
    width: 100%;
  }

  .landing-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}

.landing-hero {
  height: 100svh;
  min-height: min(790px, 100svh);
}

.landing-header,
.landing-hero-content,
.landing-scroll-cue,
.landing-features {
  width: min(100% - 2rem, 560px);
}

.landing-header {
  padding: 0.85rem 0;
}

.landing-logo {
  width: 94px;
  height: 38px;
}

.landing-brand-copy,
.landing-nav > a:first-child,
.landing-highlight,
.landing-scroll-cue,
.landing-features {
  display: none;
}

.landing-nav {
  gap: 0.9rem;
  font-size: 0.76rem;
}

.landing-nav-cta {
  padding: 0.6rem 0.8rem;
}

.landing-hero-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0;
  padding: clamp(1.25rem, 5vh, 2.5rem) 0;
}

.landing-copy {
  max-width: none;
}

.landing-copy h1 {
  margin: 1.1rem 0 0.85rem;
  font-size: clamp(2.8rem, 5vw, 3.8rem);
}

.landing-description {
  max-width: 34rem;
  font-size: 0.95rem;
}

.landing-actions {
  align-items: stretch;
  flex-direction: column;
  gap: 0.65rem;
  margin-top: 1.4rem;
}

.landing-primary,
.landing-secondary {
  width: 100%;
  min-height: 46px;
  padding: 0.7rem 0.95rem;
  font-size: 0.8rem;
}

.landing-proof {
  margin-top: 1.4rem;
  font-size: 0.7rem;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
