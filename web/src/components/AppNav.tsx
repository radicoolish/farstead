import type { ComponentType } from "react";
import { useAppData } from "../state/AppDataContext";
import { useTheme, type ThemeMode } from "../state/ThemeContext";
import type { SectionKey } from "../sections";
import { IconData, IconExpenses, IconGrowth, IconIncome, IconMoon, IconSimulator, IconSummary, IconSun, IconSystem } from "./icons";

const THEME_ORDER: ThemeMode[] = ["light", "dark", "system"];
const THEME_META: Record<ThemeMode, { label: string; Icon: ComponentType<{ className?: string }> }> = {
  light: { label: "Light theme", Icon: IconSun },
  dark: { label: "Dark theme", Icon: IconMoon },
  system: { label: "System theme", Icon: IconSystem },
};

/** Icon + label per section, shared by the nav tabs and each section's own
 * header so the two stay visually tied together. */
export const SECTION_META: Record<SectionKey, { label: string; Icon: ComponentType<{ className?: string }> }> = {
  income: { label: "Income", Icon: IconIncome },
  "401k": { label: "401(k)", Icon: IconGrowth },
  expenses: { label: "Expenses", Icon: IconExpenses },
  summary: { label: "Summary", Icon: IconSummary },
  simulator: { label: "Simulator", Icon: IconSimulator },
};

/** Canonical section order — shared with StepFooter so the "Continue" /
 * "Back" buttons walk the same sequence the tabs are laid out in. Summary
 * sits after Expenses (the last data-entry step) as a recap of everything
 * entered so far, before moving on to the free-form Simulator. */
export const SECTION_ORDER: SectionKey[] = ["income", "401k", "expenses", "summary", "simulator"];

/** Sticky top nav: one tab per section (click to switch — no forced order,
 * since revisiting an earlier section while tuning a later one is normal
 * here), with a small count badge once a section has data, plus a
 * standalone icon button that opens Data Management in a modal rather
 * than keeping it as a permanent on-page section. */
export function AppNav({
  active,
  onSelect,
  onOpenDataManagement,
}: {
  active: SectionKey;
  onSelect: (key: SectionKey) => void;
  onOpenDataManagement: () => void;
}) {
  const { people, expenses } = useAppData();
  const { mode, setMode } = useTheme();
  const counts: Partial<Record<SectionKey, number>> = { income: people.length, expenses: expenses.length };

  function cycleTheme() {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(mode) + 1) % THEME_ORDER.length];
    setMode(next);
  }

  const ThemeIcon = THEME_META[mode].Icon;

  return (
    <header className="app-nav">
      <div className="app-nav-inner">
        <div className="app-brand">
          <svg className="app-brand-mark" viewBox="0 0 48 46" aria-hidden="true">
            <line x1="5" y1="32" x2="43" y2="32" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" />
            <circle cx="32" cy="15" r="7" fill="var(--accent-2)" />
          </svg>
          <span className="app-brand-text">Farstead</span>
        </div>
        <nav className="app-tabs" aria-label="Sections">
          {SECTION_ORDER.map((key) => {
            const { label, Icon } = SECTION_META[key];
            const count = counts[key];
            return (
              <button
                key={key}
                type="button"
                className={`app-tab${active === key ? " active" : ""}`}
                onClick={() => onSelect(key)}
                aria-current={active === key ? "page" : undefined}
                aria-label={label}
              >
                <Icon className="app-tab-icon" />
                <span className="app-tab-label">{label}</span>
                {!!count && <span className="app-tab-count">{count}</span>}
              </button>
            );
          })}
        </nav>
        <button
          type="button"
          className="app-theme-button"
          onClick={cycleTheme}
          aria-label={`${THEME_META[mode].label} — click to change`}
          title={THEME_META[mode].label}
        >
          <ThemeIcon />
        </button>
        <button type="button" className="app-data-button" onClick={onOpenDataManagement} aria-label="Data management">
          <IconData />
        </button>
      </div>
    </header>
  );
}
