import type { PlanningMode } from "../sections";

/** Segmented Simple/Advanced switch — shared by both navs so the control
 * looks and behaves identically no matter which mode you're switching
 * from. The two modes keep entirely separate saved data (see
 * calc/simple.ts), so switching never overwrites anything.
 *
 * Each button carries both a full and a one-letter label (see
 * .mode-toggle-full/.mode-toggle-short in index.css) — on a narrow phone
 * screen, "Simple"/"Advanced" spelled out left no room for the section
 * tabs next to them, the same collapse-to-icon treatment the tabs
 * themselves already get via .app-tab-label. */
export function PlanningModeToggle({ mode, onChange }: { mode: PlanningMode; onChange: (mode: PlanningMode) => void }) {
  return (
    <div className="app-mode-toggle" role="group" aria-label="Planning mode">
      <button
        type="button"
        className={mode === "simple" ? "primary" : undefined}
        onClick={() => onChange("simple")}
        aria-pressed={mode === "simple"}
        aria-label="Simple mode"
        title="Simple mode"
      >
        <span className="mode-toggle-full" aria-hidden="true">Simple</span>
        <span className="mode-toggle-short" aria-hidden="true">S</span>
      </button>
      <button
        type="button"
        className={mode === "advanced" ? "primary" : undefined}
        onClick={() => onChange("advanced")}
        aria-pressed={mode === "advanced"}
        aria-label="Advanced mode"
        title="Advanced mode"
      >
        <span className="mode-toggle-full" aria-hidden="true">Advanced</span>
        <span className="mode-toggle-short" aria-hidden="true">A</span>
      </button>
    </div>
  );
}
