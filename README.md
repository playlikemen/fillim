<p align="center">
  <img src="docs/fillim-mark.svg" alt="Fillim" height="64">
</p>

<h1 align="center">Fillim</h1>

<p align="center">
  <strong>Direct films in code. Cut them on a real timeline.</strong><br>
  A cloud film studio where an AI Director writes your shots and you finish them by hand — in the browser, no install.
</p>

<p align="center">
  <a href="https://fillim.campusloop.space"><strong>Start free → fillim.campusloop.space</strong></a> ·
  <a href="https://fillim.campusloop.space/#pricing">Pricing</a> ·
  <a href="https://github.com/playlikemen/fillim/issues">Issues</a>
</p>

---

## What Fillim does

Most AI video tools hand you a clip and a reroll button. Fillim hands you the film itself.

1. **Prompt.** Tell the built-in AI Director what you want — a title card, a product reveal, an explainer beat. It writes the shot as real, readable HTML.
2. **Cut.** Open it on a multi-track timeline. Trim, split, retime, fade, caption, and grade it by hand. Your manual edits are kept as overrides, so the next AI rewrite never wipes them out.
3. **Export.** Render a frame-exact MP4 or WebM, or hand the edit to Premiere, Resolve, or Final Cut as an XML timeline.

What you scrub in the preview is exactly what you export: every frame is a pure function of time, so there is no "it looked different in the render".

## Four workbenches, one film

| Workbench | For |
| --- | --- |
| **Screening** | Full-bleed playback, frame-accurate scrubbing, notes on a moment or a span |
| **Edit** | Multi-track timeline, trim/split, speed, volume, fades, word-by-word captions (WebVTT) |
| **Canvas** | Storyboard boards to plan shots and sequences |
| **Color** | Live waveform, parade and vectorscope, color wheels, curves, `.cube` LUTs |

## Plans

| Plan | Price | Includes |
| --- | --- | --- |
| **Free** | ₹0 | 100 credits on sign-up, all four workbenches, AI Director, MP4/WebM export |
| **Creator** | ₹499 / 30 days | +1,000 credits, NLE XML export, priority renders |
| **Studio** | ₹1,499 / 30 days | +5,000 credits, larger AI Director budget, priority support |

Paid plans are one-time 30-day passes paid through Razorpay. They do not auto-renew.

Sign in with Google, Microsoft, GitHub, or email at **[fillim.campusloop.space](https://fillim.campusloop.space)**.

---

## For developers

Fillim is open source (MIT). You can run your own copy.

**Requirements:** Node.js ≥ 22.18, pnpm (`corepack enable`), `ffmpeg` on `PATH`, a Postgres database with auth (see `neon.ts`).

```bash
git clone https://github.com/playlikemen/fillim.git
cd fillim
pnpm install
pnpm --filter openfilm exec playwright-core install chromium-headless-shell
pnpm build
pnpm dev
```

Configuration goes in `.env.local` (never committed): `DATABASE_URL`, auth URLs, an AI provider key for the AI Director, and optionally `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` for paid plans.

```bash
pnpm typecheck
pnpm test
```

### Layout

- `packages/openfilm/studio/server` — HTTP server, accounts, projects, billing (`saas/`)
- `packages/openfilm/studio/ui` — the React studio and the Fillim site (`src/saas/`)
- `scripts/deploy-vps.sh` — production deploy used by `.github/workflows/deploy.yml`

### Deploys

Every push to `main` is typechecked and built on GitHub Actions, then deployed to production by a self-hosted runner, with an automatic rollback if the health check fails.

## Credits

Fillim's film engine is built on the open-source [OpenFilm](https://github.com/openfilm/openfilm) project (MIT). Fillim is an independent product and is not affiliated with or endorsed by OpenFilm.
