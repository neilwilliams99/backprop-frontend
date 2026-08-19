# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

BackProp is a static web app for slab back-propping design, deployed at `https://backpropslabs.com`. There is no build system, no package manager and no framework — raw HTML, CSS and vanilla JS served as static files. To run it, open `index.html` in a browser or serve the directory with any static file server (e.g. `npx serve .`).

## External Dependencies (CDN-loaded)

- **SheetJS** (`xlsx.full.min.js`) — Excel export
- **Supabase JS v2** — auth and database
- **Google Fonts** — DM Mono, Syne
- **Google Analytics** — gtag `G-3295C7MKRF`

## Source Layout

`index.html` holds all markup; behaviour and styling live in `js/` and `css/`.

| File | Responsibility |
|------|----------------|
| `js/config.js` | Supabase URL/anon key, `supa` client, `API_URL`, `TRIAL_DAYS`, `ADMIN_IDS` |
| `js/utils.js` | `esc()`, `showToast()` |
| `js/dialogs.js` | Promise-based replacements for `confirm`/`prompt`/`alert` |
| `js/state.js` | Working globals (`project`, `levels`, `calcResults`) and small helpers — `isBaseLevel()`, `getProps()`, `getPropCap()`, `makeBlEntry()` |
| `js/auth.js` | Login/signup/reset flows, `initAuth()` |
| `js/subscription.js` | Trial countdown, `checkAccess()`, paywall, Stripe checkout |
| `js/projects.js` | `projectStore[]`, `dbLoadProjects()`, `dbSaveProject()`, `saveActiveProject()`, `scheduleSave()`, project list UI |
| `js/levels.js` | Building Levels page — `renderLevels()` |
| `js/zones.js` | Zones page — per-zone back-propping configuration, `renderZones()` |
| `js/props.js` | Prop library CRUD |
| `js/calc.js` | **Calculation engine** — `computeLoadSharing()`, `runCalc()` |
| `js/engineer-view.js` | Detailed results matrices |
| `js/builder-view.js` | Step-by-step construction sequence |
| `js/settings.js` | Project settings modal, `setCalcMethod()`, `updateSummary()`, `showPage()` |
| `js/user-settings.js` | User profile, Stripe billing portal |
| `js/export.js` | `exportResults()` → Excel via SheetJS |
| `js/init.js` | App startup — `onAuthStateChange` handler, calls `initAuth()` |

**Load order matters.** These are plain `<script>` tags, not modules — every function and variable is global. The order is fixed at the bottom of `index.html`: `config.js` must come first (it creates `supa`), `init.js` last (it starts the app). Adding a file means adding a tag in the right place.

## Data Model

```
projectStore[]          — all user projects (loaded from Supabase on login)
  project               — { name, jobNo, prepBy, concDensity, maxSpacing, props[], calcMethod }
  levels[]              — bottom-to-top; index 0 is always the immutable base/ground level
    level               — { id, name, thickness, slabCap, addLoad, zones[], isBase }
      zone              — { id, name, thickness, addLoad, levelsBelow[] }
        levelsBelow[]   — top-to-bottom, the back-prop stack for this zone:
                          { levelId, active, slabCap, addLoad, propId, propSnapshot,
                            propCapOverride, sm, distPct }
  calcResults           — output of runCalc(); null means stale/uncalculated
```

`sm` (slab stiffness modifier) applies to Load Balancing only; `distPct` to Load Sharing only. Opening a project copies its data into the global working state; `saveActiveProject()` writes it back to `projectStore` and `scheduleSave()` debounces a Supabase persist.

An entry in `levelsBelow` represents **the props bearing on that level**, so the base-level entry is a real prop line and gets a spacing like any other — it is not merely a terminal marker.

## Calculation Engine

`runCalc()` supports two methods, set by `project.calcMethod`:

- **`'balancing'`** — each slab absorbs its capacity (`slabCap × sm`) from the load passing down
- **`'sharing'`** — each slab attracts a nominated percentage (`distPct`) of the wet load

Each method splits again on whether the prop stack reaches the base level (T/G) or terminates above it.

### Additional load — applied at the level it occurs

This convention is shared by both methods and is easy to get wrong. A level's `addLoad` is added to the load arriving from above **at that level**, so the props bearing on that level are sized for it, and it stays in the cascade below.

Load Sharing runs the whole thing through `computeLoadSharing()`:

```
wet_share    = wetTotal × distPct / 100
prop_load_in = carry + addLoad          ← prop design load at this level
slab_load    = wet_share + addLoad      ← slab capacity check, both cases
carry        = prop_load_in                  (propped to ground)
             = prop_load_in − slab_load      (not propped to ground)
```

Not propped to ground: `distPct` must sum to 100 % (enforced in pre-flight), so each slab absorbs its share plus its own `addLoad` and the cascade resolves to exactly zero after the last level.

Propped to ground: intermediate slabs are propped through and absorb nothing; the ground level takes `distPct = 100` internally so its slab check reads the full wet load plus its own add load.

**Intermediate `addLoad` is deliberately counted twice in the T/G case** — once against that slab's own capacity, and once in the prop line below it. These are two separate load paths, and a slab you have chosen to prop through cannot be relied on to shed its construction load. This is not a double-count bug; do not "fix" it.

Load Balancing follows the same placement rule, with `carry = max(0, cumLoad − slabCap × sm)` for the non-T/G case and `carry = cumLoad` for T/G.

### Testing changes

There is no test framework. The engine is verifiable in isolation by loading `js/calc.js` into a Node `vm` context with the handful of globals it touches stubbed (`project`, `levels`, `isBaseLevel`, `getProps`, `getPropCap`, `showToast`, the render functions) and asserting on `calcResults`. Worth doing for any change to the cascade.

## Backend API

Subscriptions and Stripe checkout are handled by a separate FastAPI service, `https://backprop-api.onrender.com` (source in the `backprop-api` repo; Render free tier, so cold starts are expected). Endpoints used: `/subscription-status`, `/create-checkout-session`, `/create-portal-session`.

The API is a billing boundary, nothing more — it holds the Stripe secret and the Supabase service-role key. **The calculation engine is not behind it**; it runs entirely in the browser and is fully visible to anyone reading the page source.

## Supabase

- Projects stored in the `projects` table: `id, user_id, name, job_no, prep_by, data (jsonb), updated_at`
- The full project payload (levels, zones, calcResults) is stored in the `data` column as JSON
- Auth uses Supabase email/password with magic-link password reset
