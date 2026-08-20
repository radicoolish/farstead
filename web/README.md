# Farstead — React

React + TypeScript rewrite of the Streamlit app one level up (`../app.py`). See the scoping
artifact for the full plan: https://claude.ai/code/artifact/0491843b-4f54-4a8b-9e5d-ad2985cb3b8c

## Status: Phase 0 (Foundation) complete

- `src/calc/` — the full calculation engine, ported from `app.py` and verified against it:
  age math, the federal/state tax estimator, the Social Security estimator, 401(k) balance
  projection, household income/withdrawal/Social Security/expense projections. No UI depends
  on this yet — `App.tsx` is a placeholder.
- `src/calc/*.test.ts` — 43 unit tests (Vitest), several with expected values cross-checked
  against independent from-scratch reference calculations (not copy-pasted from app.py) to
  catch porting mistakes in either direction.
- No chart-shaping logic ported yet (the household scenario-combination generator, the
  expense chart data-frame builder) — those are tied to how Recharts will actually want the
  data shaped, better decided when the chart components are built (Phase 2+) than guessed now.

## Commands

```bash
npm install       # first time only
npm run dev       # dev server, http://localhost:5173
npm run build     # type-check + production build
npm run test      # run the test suite once
npm run test:watch
```

## Next steps (see the scoping artifact for the full phase list)

Phase 1: Income section — person CRUD, tax estimator, localStorage persistence wired end to
end. This is the first phase that touches UI at all.
