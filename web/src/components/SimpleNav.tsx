import type { ComponentType } from "react";
import { useTheme, type ThemeMode } from "../state/ThemeContext";
import type { PlanningMode, SimpleSectionKey } from "../sections";
import { IconFlag, IconIncome, IconMoon, IconSun, IconSystem, LogoMark } from "./icons";
import { PlanningModeToggle } from "./PlanningModeToggle";

const THEME_ORDER: ThemeMode[] = ["light", "dark", "system"];
const THEME_META: Record<ThemeMode, { label: string; Icon: ComponentType<{ className?: string }> }> = {
  light: { label: "Light theme", Icon: IconSun },
  dark: { label: "Dark theme", Icon: IconMoon },
  system: { label: "System theme", Icon: IconSystem },
};

export const SIMPLE_SECTION_META: Record<SimpleSectionKey, { label: string; Icon: ComponentType<{ className?: string }> }> = {
  inputs: { label: "Inputs", Icon: IconIncome },
  results: { label: "Results", Icon: IconFlag },
};

export const SIMPLE_SECTION_ORDER: SimpleSectionKey[] = ["inputs", "results"];

/** Simple mode's own top nav — just two tabs (Inputs/Results) instead of
 * Advanced's five, and no data-management button (Simple mode has nothing
 * to import/export/scenario-build yet). Deliberately not sharing AppNav
 * itself: that component reads people/expenses counts via useAppData,
 * which only exists inside AppDataProvider — wrapping Simple mode in that
 * provider just to reuse the nav would blur the "these two modes keep
 * fully separate data" boundary the rest of this feature is built on. */
export function SimpleNav({
  active,
  onSelect,
  onShowWelcome,
  planningMode,
  onPlanningModeChange,
}: {
  active: SimpleSectionKey;
  onSelect: (key: SimpleSectionKey) => void;
  onShowWelcome: () => void;
  planningMode: PlanningMode;
  onPlanningModeChange: (mode: PlanningMode) => void;
}) {
  const { mode, setMode } = useTheme();

  function cycleTheme() {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(mode) + 1) % THEME_ORDER.length];
    setMode(next);
  }

  const ThemeIcon = THEME_META[mode].Icon;

  return (
    <header className="app-nav">
      <div className="app-nav-inner">
        <div className="app-brand">
          <LogoMark className="app-brand-mark" />
          <span className="app-brand-text">Farstead</span>
        </div>
        <nav className="app-tabs" aria-label="Sections">
          {SIMPLE_SECTION_ORDER.map((key) => {
            const { label, Icon } = SIMPLE_SECTION_META[key];
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
              </button>
            );
          })}
        </nav>
        <PlanningModeToggle mode={planningMode} onChange={onPlanningModeChange} />
        <button
          type="button"
          className="app-theme-button"
          onClick={cycleTheme}
          aria-label={`${THEME_META[mode].label} — click to change`}
          title={THEME_META[mode].label}
        >
          <ThemeIcon />
        </button>
        <button type="button" className="app-welcome-button" onClick={onShowWelcome} aria-label="About Farstead" title="About Farstead">
          <LogoMark />
        </button>
      </div>
    </header>
  );
}
