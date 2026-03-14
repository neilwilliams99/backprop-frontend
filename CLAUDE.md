# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

BackProp is a single-file web app (`index.html`) for slab back-propping design. There is no build system, no package manager, and no framework — the entire application is raw HTML, CSS, and vanilla JS (~4000 lines) served as a static file. To "run" it, open `index.html` in a browser or serve it with any static file server (e.g. `npx serve .`).

## External Dependencies (CDN-loaded)

- **SheetJS** (`xlsx.full.min.js`) — Excel export
- **Supabase JS v2** — auth and database
- **Google Fonts** — DM Mono, Syne
- **Google Analytics** — gtag `G-3295C7MKRF`

## Architecture

Everything lives in `index.html`. The JS is divided into named sections (marked with `// ════` banners):

| Line | Section |
|------|---------|
| 1421 | **SUPABASE CONFIG + AUTH** — `SUPA_URL`, `SUPA_KEY`, login/signup/reset flows, `initAuth()` |
| 1803 | **MULTI-PROJECT STATE** — `projectStore[]`, `activeProjectId`, `dbLoadProjects()`, `dbSaveProject()` |
| 2049 | **ACTIVE STATE** — working globals: `project`, `levels`, `calcResults` |
| 2157 | **PAGE NAVIGATION** — tab switching |
| 2174 | **BUILDING LEVELS PAGE** — `renderLevels()` |
| 2246 | **ZONES PAGE** — `renderZones()`, per-zone back-propping configuration |
| 2551 | **PROP LIBRARY** — `renderModalPropTable()`, prop CRUD |
| 2718 | **CALCULATION ENGINE** — `runCalc()`, the core structural calculation |
| 3072 | **ENGINEER VIEW** — detailed matrix results, `renderEngineerView()` |
| 3329 | **BUILDER VIEW** — step-by-step construction sequence, `renderBuilderView()` |
| 3457 | **PROJECT SETTINGS** — project modal |
| 3535 | **EXPORT** — `exportResults()` → Excel via SheetJS |
| 3755 | **SUBSCRIPTION & PAYWALL** — `checkAccess()`, Stripe checkout via backend API |
| 3879 | **USER SETTINGS** |
| 3982 | **INIT** — app startup after Supabase `onAuthStateChange` |

## Data Model

```
projectStore[]          — all user projects (loaded from Supabase on login)
  project               — { name, jobNo, prepBy, concDensity, maxSpacing, props[], calcMethod }
  levels[]              — bottom-to-top; index 0 is always the immutable base/ground level
    level               — { id, name, thickness, slabCap, addLoad, zones[], isBase }
      zone              — { id, name, thickness, levelsBelow: [{ levelId, active, slabCap, addLoad, propId, propSnapshot, propCapOverride }] }
  calcResults           — output of runCalc(); null means stale/uncalculated
```

When a project is opened, its data is copied into the global working state (`project`, `levels`, `calcResults`). `saveActiveProject()` writes it back to `projectStore`; `scheduleSave()` debounces a Supabase persist.

## Calculation Methods

`runCalc()` supports two methods (set via `project.calcMethod`):
- **`'balancing'`** — prop loads balanced against slab capacities
- **`'sharing'`** — load shared across load-bearing slabs

## Backend API

Subscription and Stripe checkout are handled by a separate backend: `https://backprop-api.onrender.com` (hosted on Render free tier — cold starts expected). Endpoints used: `/subscription-status`, `/create-checkout-session`.

## Supabase

- Projects stored in the `projects` table: `id, user_id, name, job_no, prep_by, data (jsonb), updated_at`
- The full project payload (levels, zones, calcResults) is stored in the `data` column as JSON
- Auth uses Supabase email/password with magic-link password reset
