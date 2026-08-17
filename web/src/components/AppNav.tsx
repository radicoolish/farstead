import type { ComponentType } from "react";
import { useAppData } from "../state/AppDataContext";
import type { SectionKey } from "../sections";
import { IconData, IconExpenses, IconGrowth, IconIncome, IconSimulator } from "./icons";

/** Icon + label per section, shared by the nav tabs and each section's own
 * header so the two stay visually tied together. */
export const SECTION_META: Record<SectionKey, { label: string; Icon: ComponentType<{ className?: string }> }> = {
  income: { label: "Income", Icon: IconIncome },
  "401k": { label: "401(k)", Icon: IconGrowth },
  expenses: { label: "Expenses", Icon: IconExpenses },
  simulator: { label: "Simulator", Icon: IconSimulator },
};

const ORDER: SectionKey[] = ["income", "401k", "expenses", "simulator"];

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
  const counts: Partial<Record<SectionKey, number>> = { income: people.length, expenses: expenses.length };

  return (
    <header className="app-nav">
      <div className="app-nav-inner">
        <div className="app-brand">
          <span className="app-brand-mark" aria-hidden="true" />
          <span className="app-brand-text">Investment Scenario Planner</span>
        </div>
        <nav className="app-tabs" aria-label="Sections">
          {ORDER.map((key) => {
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
        <button type="button" className="app-data-button" onClick={onOpenDataManagement} aria-label="Data management">
          <IconData />
        </button>
      </div>
    </header>
  );
}
