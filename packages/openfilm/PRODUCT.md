# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Founders, developers, and AI-first creators building motion films, product launches, explainers, and web-native videos who want coding agents and a direct browser NLE studio to operate on the same underlying film artifact.

## Product Purpose

Fillim turns OpenFilm's deterministic web-native film engine into a multi-tenant cloud SaaS (`https://fillim.campusloop.space`, `https://github.com/playlikemen/fillim`). A user signs in, creates or duplicates film workspaces persisted in Neon Lakebase Postgres, iterates with code or timeline controls in Studio, grades frames with live WebGL scopes, and exports deterministic MP4, WebM, or NLE interchange files without local installation.

## Positioning

Unlike opaque prompt-to-video generators that trap creators inside rerolls, every Fillim project is real, inspectable HTML/CSS/JS running a deterministic `window.film.frame(t)` clock inside a 4-workbench browser studio (Screening, Edit, Canvas, Color) where manual timeline overrides never get overwritten by AI code edits.

## Operating Context

- **Public origins**: Main app on `https://fillim.campusloop.space` (`:4848`), read-only film stage on `https://fillim-film.campusloop.space` (`:4849`), and plugin workbenches on `https://fillim-plugins.campusloop.space` (`:4850`) behind Cloudflare Tunnel (`cloudflared.service`) and systemd (`fillim.service`).
- **Workspace flow**: Visitors land on `/`, authenticate via `/auth` (Google, Microsoft, GitHub OAuth via Neon Auth or email/password), manage isolated films and credit usage on `/projects`, and launch the 4-workbench Studio editor on `/p/<id>`.
- **Commercial stage**: Early-access free workspace granting 100 render credits on sign-up; unverified paid tiers, customer logos, benchmarks, and testimonials are intentionally omitted.

## Capabilities and Constraints

- **Deterministic preview & export parity**: `window.film.frame(t)` renders identically in interactive scrubbers and headless Chromium + FFmpeg exports (`MP4`, `WebM`, plus `FCPXML` / Premiere / Resolve XML).
- **Four NLE workbenches**:
  - **Screening**: full-bleed playback, frame-accurate SMPTE scrub, span notes, spatial layer pointing.
  - **Edit**: multi-track timeline, trim/split, speed/volume/fades, word-by-word typography, WebVTT captions, non-destructive `overrides` stored in `film.html`.
  - **Canvas**: spatial storyboard and generative node boards stored in Postgres-backed workspace state.
  - **Color**: real-time WebGL waveform/parade/vectorscope scopes, color wheels, curves, and `.cube` LUT grading.
- **Database & Auth**: `@neondatabase/serverless` over HTTPS (`saas_users`, `saas_projects`, `saas_usage_events`) and Neon Auth (`/api/auth/*` proxy + EdDSA JWKS verification via `jose`). Social OAuth wires Google, Microsoft, and GitHub via `authClient.signIn.social` and `/auth/callback` session verification; production domain allowlisting and GitHub/Microsoft provider credentials depend on claiming the Neon project (`little-math-86177057`).
- **Three-origin security isolation**: Untrusted film code and plugin panels run on isolated preview/plugin origins (`:4849` / `:4850`) communicating via `postMessage`. Existing local CLI `?key=` access on localhost must stay functional alongside SaaS auth.
- **Explicit non-claims**: Future roadmap ideas (such as integrating features inspired by `storytold/filmcraft`) must not be presented as shipped capabilities.

## Brand Commitments

- **Product identity**: Named **Fillim** (`Fillim Cloud Studio`), hosted at `fillim.campusloop.space` and repository `playlikemen/fillim`.
- **Attribution & trademark compliance**: Honestly state "Built on OpenFilm" (MIT code license), keep Fillim's own name and mark distinct from OpenFilm, and never imply official OpenFilm endorsement per `packages/openfilm/TRADEMARK.md`.

## Evidence on Hand

- Interactive `window.film.frame(t)` deterministic scrubber (playable 4s sample loop with live title and color parameter overrides) verified directly in the browser without faked video claims.
- Real capabilities verified in codebase: Neon Lakebase Postgres persistence, Neon Auth session proxy + EdDSA verification, 4 studio workbenches, multi-origin isolation, headless Chromium + FFmpeg export, and FCPXML/Resolve XML interchange.
- **Absences**: Zero invented user counts, testimonials, logos, latency benchmarks, or paid subscription tiers.

## Product Principles

1. **Deterministic over probabilistic**: Show exact frames, timecodes, and editable controls rather than black-box claims.
2. **Code and cut on equal footing**: Agents write code; humans scrub, trim, point, and grade in real time without losing manual overrides.
3. **Isolation and honesty first**: Keep 3-origin sandboxing, Neon Postgres user isolation, and truthful capability boundaries visible and verifiable.
