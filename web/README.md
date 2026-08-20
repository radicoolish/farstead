# Farstead — React app

The active codebase — see the [repo root README](../README.md) for the full feature list,
install instructions, and project structure. This file covers just the day-to-day commands
for working in `web/`.

## Commands

```bash
npm install          # first time only
npm run dev           # dev server, http://localhost:5173
npm run build          # type-check + production build to dist/
npm run preview        # serve the production build locally
npm run test            # run the test suite once (Vitest)
npm run test:watch
npm run lint             # oxlint
npm run tauri build       # desktop installer (needs the Rust toolchain — see root README)
```

## Notes for contributors

- `src/calc/` has no React dependency and is the source of truth for every number the app
  shows — port logic here first, wire it into components second.
- Number inputs use `<NumberField>` (`src/components/NumberField.tsx`), not raw
  `<input type="number">` — it fixes the classic "clearing the field snaps back to 0"
  controlled-input bug.
- Color tokens live in `src/index.css` as CSS custom properties (light + dark + explicit
  toggle) and are hand-verified against WCAG 2.1 AA — don't hardcode colors in components.
- `npm run build` uses the default `base: '/'`; the GitHub Pages deploy workflow overrides it
  with `--base=/farstead/` for that one build only (see
  `../.github/workflows/deploy-pages.yml`). Local dev and the Tauri desktop build are
  unaffected.
