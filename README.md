# Farstead

A household financial planner: income, 401(k) growth, expenses, and retirement all in one
place, with a scenario simulator for stress-testing assumptions before you have to live with
them. Runs entirely client-side — your numbers never leave your device — and installs as a
desktop app (Windows) or a mobile/home-screen app (Android, iOS).

**Live app:** https://radicoolish.github.io/farstead/

## Features

- **Household Income** — per-person salary, 401(k) contribution/match, HSA, medical insurance,
  and effective tax rate, with a built-in tax-rate estimator (state + filing status) and a
  Social Security benefit estimator (bend-point PIA calculation with early/delayed claim
  adjustment).
- **401(k) Planner** — year-by-year balance projection to retirement for each person, plus up
  to 4 saved "what-if" scenarios per person (vary one assumption — contribution %, growth
  rate, salary increase, retirement age — and compare against the base projection on the same
  chart). A household-wide combined view charts every scenario combination at once.
- **Household Expenses** — recurring costs (mortgage, loans, utilities, insurance, childcare,
  and more) with support for loans that pay off on a term, inflation-adjusted recurring costs,
  and perpetual expenses. Six linked charts show income, withdrawals, Social Security,
  expenses, and net cash flow across the full household timeline.
- **Summary** — a capstone recap of Income + 401(k) + Expenses in headline numbers, toggle
  between Total / Pre-Retirement / Retirement period averages, and an at-a-glance surplus vs.
  deficit callout with the age (if any) expenses first outpace income.
- **Simulator** — a sandboxed, non-persisted "what if everything were different" mode: reset
  any assumption per person, step to a new income at a given age, or apply a market condition
  (sustained bear/bull market, or an illustrative replay of the dot-com bust, the 2008
  financial crisis, or the 2020 COVID crash) starting at whatever age and lasting however long
  you choose.
- **Data management** — export your full household as JSON, re-import it later or on another
  device, or clear everything and start over. Nothing is ever sent to a server.

## Installing

| Platform | How |
| --- | --- |
| **Desktop (Windows)** | Download the latest installer from [Releases](https://github.com/radicoolish/farstead/releases), or build it yourself — see below. |
| **Android / iOS** | Open the [live app](https://radicoolish.github.io/farstead/) in Chrome (Android) or Safari (iOS) and choose **Add to Home Screen** / **Install app**. It works offline after the first load. |

## Tech stack

React 19 + TypeScript, built with Vite. Charts via Recharts. State persisted to
`localStorage` — no backend, no accounts, no analytics. Desktop packaging via
[Tauri](https://tauri.app/) 2. Installable-on-mobile via a
[PWA](https://web.dev/progressive-web-apps/) manifest + service worker
(`vite-plugin-pwa`).

## Getting started

```bash
cd web
npm install
npm run dev       # dev server at http://localhost:5173
npm run test      # run the test suite (Vitest)
npm run build     # type-check + production build to web/dist
```

### Desktop build (Windows)

Requires the Rust toolchain (`rustup`) in addition to Node:

```bash
cd web
npm run tauri build
```

Produces an MSI and an NSIS installer under
`web/src-tauri/target/release/bundle/`.

### Deployment

Pushing to `master` builds `web/` and deploys it to GitHub Pages automatically via
[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml). The production
build is a static site with no server-side code.

## Project structure

```
web/src/
  calc/         Pure calculation engine (age, tax, Social Security, 401(k) projection,
                expenses, market conditions, summary/period averaging) — no React
                dependency, fully unit-tested.
  components/   UI, one component per concern (forms, charts, stat tiles, sections).
  state/        AppDataContext (people/expenses/settings, localStorage-backed) and
                ThemeContext (light/dark/system).
  chart/        Shared chart utilities (Recharts wrappers, color palette, formatting).
  simulator/    Simulator-only sandboxed state (never persisted).
  storage/      JSON export/import + schema validation.
web/src-tauri/  Tauri desktop shell config, icons, and Rust entry point.
```

## Legacy prototype

`app.py` (repo root) is the original Streamlit mockup this app was rebuilt from — kept for
reference only. All active development happens in `web/`.
