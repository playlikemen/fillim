<p align="center">
  <img src="docs/logo-light.svg#gh-light-mode-only" alt="Fillim" height="48">
  <img src="docs/logo-dark.svg#gh-dark-mode-only" alt="Fillim" height="48">
</p>

<h1 align="center">Fillim</h1>

<p align="center">
  <strong>Cloud AI Film &amp; Video Studio</strong> — built on <a href="https://github.com/openfilm/openfilm">OpenFilm</a>, powered by Neon Lakebase Postgres and Neon Auth.
</p>

<p align="center">
  <a href="https://fillim.campusloop.space">Live SaaS</a> ·
  <a href="https://github.com/playlikemen/fillim">Repository</a> ·
  <a href="https://github.com/playlikemen/fillim/issues">Issues</a> ·
  <a href="LICENSE">MIT License</a>
</p>

---

## Overview

**Fillim** transforms OpenFilm's deterministic web-native video engine into a multi-tenant cloud SaaS platform. Create films with AI coding agents or directly in the browser, edit every shot by hand on a frame-accurate timeline, grade with live scopes, and export MP4, WebM, or NLE timelines — with isolated user workspaces persisted in Neon Postgres.

### Key Capabilities

- **Fillim Cloud SaaS**: Landing stage with interactive deterministic `window.film.frame(t)` preview, Neon Auth sign-up/sign-in, per-user workspace isolation, credit ledger, and usage tracking in Neon Lakebase Postgres.
- **Four NLE Workbenches**:
  - **Screening**: full-size review, moment/span selection, and spatial layer pointing.
  - **Edit**: multi-track timeline, trimming, splitting, speed/volume/fades, word-by-word typography, WebVTT captions, and headless Chromium + FFmpeg exports (plus FCPXML/Premiere/Resolve export).
  - **Canvas**: spatial storyboard and generative node planning board.
  - **Color**: real-time scopes (waveform, parade, vectorscope), color wheels, curves, and `.cube` LUT grading.
- **Non-Destructive Overrides**: Hand edits inside shots are stored in `film.html` `overrides` so code rewrites never wipe out your manual adjustments.
- **Isolated 3-Origin Security**: Studio editor (`:4848`), read-only film preview (`:4849`), and plugin workbenches (`:4850`) run on separate origins (with public HTTPS tunnel routing for `fillim.campusloop.space`, `fillim-film.campusloop.space`, and `fillim-plugins.campusloop.space`).

---

## Architecture

| Layer | Technology |
| --- | --- |
| **Database** | Neon Lakebase Postgres (`@neondatabase/serverless` over HTTPS) — `saas_users`, `saas_projects`, `saas_usage_events` |
| **Authentication** | Neon Auth (Managed Better Auth) + same-origin `/api/auth/*` proxy + EdDSA JWKS verification (`jose`) |
| **Editor Frontend** | React 19, TypeScript, Vite 7, Tailwind CSS v4 (`packages/openfilm/studio/ui`) |
| **Render & Export** | Node.js 22, Playwright (`chromium-headless-shell`), FFmpeg |
| **Tunneling** | Cloudflare Tunnel (`fillim.campusloop.space`, `fillim-film.campusloop.space`, `fillim-plugins.campusloop.space`) |

---

## Quick Start

### Prerequisites

- Node.js `>= 22.18`
- `pnpm` (`corepack enable`)
- `ffmpeg` on `PATH`
- Neon CLI (`neon`)

### 1. Provision Neon Postgres & Neon Auth

```bash
# If starting without an existing Neon account:
neon claim create --env-pull

# Or link an existing Neon project:
neon link --project-id <project-id> -y
```

This writes `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL`, and `NEON_AUTH_JWKS_URL` into `.env.local` using the configuration in [`neon.ts`](neon.ts).

### 2. Install & Build

```bash
git clone https://github.com/playlikemen/fillim.git
cd fillim
pnpm install
pnpm --filter openfilm exec playwright-core install chromium-headless-shell
pnpm build
```

### 3. Run Studio

```bash
# Start Studio in dev mode (or run packages/openfilm/studio/server/main.mjs with .env.local loaded)
pnpm dev
```

### 4. Typecheck & Test

```bash
pnpm typecheck
pnpm test
```

---

## Repository Metadata & Attribution

- **SaaS Repository**: [`playlikemen/fillim`](https://github.com/playlikemen/fillim)
- **Live Preview**: [`https://fillim.campusloop.space`](https://fillim.campusloop.space)
- **Upstream Engine**: Built on [`openfilm/openfilm`](https://github.com/openfilm/openfilm) (MIT License)
- **Planned Additions**: Additional filmmaking modules and craft workflows via [`storytold/filmcraft`](https://github.com/storytold/filmcraft)
