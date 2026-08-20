import type { SectionKey } from "../sections";
import { SECTION_META, SECTION_ORDER } from "./AppNav";

/** Prev/next navigation between sections, in the same order as the top
 * nav — lets someone walk Income → 401(k) → Expenses → Simulator with a
 * click instead of only via the tabs. Doesn't gate progression (you can
 * still jump ahead via the tabs at any time); it's just a faster path
 * through the sections in order. */
export function StepFooter({ active, onSelect }: { active: SectionKey; onSelect: (key: SectionKey) => void }) {
  const index = SECTION_ORDER.indexOf(active);
  const prev = index > 0 ? SECTION_ORDER[index - 1] : null;
  const next = index < SECTION_ORDER.length - 1 ? SECTION_ORDER[index + 1] : null;

  if (!prev && !next) return null;

  return (
    <div className="step-footer">
      <div>
        {prev && (
          <button type="button" onClick={() => onSelect(prev)}>
            ← Back to {SECTION_META[prev].label}
          </button>
        )}
      </div>
      <div>
        {next && (
          <button type="button" className="primary" onClick={() => onSelect(next)}>
            Continue to {SECTION_META[next].label} →
          </button>
        )}
      </div>
    </div>
  );
}
