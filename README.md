# PAMANA Frontend

For the first Vercel preview, follow [deployment settings and integration requirements](documentation/vercel-deployment.md).
Use `npm ci`, `npm test`, and `npm run build` for portable frontend validation.

MapLibre GL JS with Geoapify is PAMANA's sole supported production mapping stack.
Configure the public Geoapify settings from `.env.example` for basemaps and geographic search.
Missing configuration shows a readable unavailable state; there is no legacy renderer fallback.

See [Phase 25B validation](documentation/phase-25b-remove-leaflet.md) for the supported maps and cleanup evidence.
Phase 24.5 real-device Driver/GPS acceptance remains OPEN under the approved prototype Path B.

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
