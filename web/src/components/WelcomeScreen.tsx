import { SECTION_META, SECTION_ORDER } from "./AppNav";
import { LogoMark } from "./icons";

const FEATURE_COPY: Record<(typeof SECTION_ORDER)[number], string> = {
  income: "Enter each person's salary, 401(k) contributions, and tax rate.",
  "401k": "See balances projected to retirement, plus what-if scenarios.",
  expenses: "Track recurring costs — mortgage, loans, insurance, and more.",
  summary: "Find your earliest sustainable retirement year, plus the big picture across income and expenses.",
  simulator: "Stress-test assumptions — market downturns, income changes.",
};

/** First-run, full-screen intro — shown once (tracked via localStorage),
 * dismissed with "Get Started". Explains what the app does before dropping
 * someone into the Income form with no context, which matters more here
 * than on desktop since this is often someone's first time opening the app
 * at all (a fresh mobile install) rather than a returning desktop user. */
export function WelcomeScreen({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "calc(2rem + env(safe-area-inset-top)) 1.5rem calc(2rem + env(safe-area-inset-bottom))",
        overflowY: "auto",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        <LogoMark className="welcome-logo" />

        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Welcome to Farstead</h1>
        <p style={{ fontSize: "0.95rem", color: "var(--ink-soft)", margin: "0 0 2rem", lineHeight: 1.5 }}>
          A household planner for income, 401(k) growth, expenses, and retirement — all in one place, worked out
          together instead of guessed at separately.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", textAlign: "left", marginBottom: "2rem" }}>
          {SECTION_ORDER.map((key) => {
            const { label, Icon } = SECTION_META[key];
            return (
              <div key={key} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                <div
                  style={{
                    flex: "none",
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon className="app-tab-icon" />
                </div>
                <div>
                  <div style={{ fontWeight: 650, fontSize: "0.9rem" }}>{label}</div>
                  <div className="caption" style={{ marginTop: "0.1rem" }}>
                    {FEATURE_COPY[key]}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="caption" style={{ marginBottom: "1.5rem" }}>
          No accounts, no servers — everything you enter stays on this device.
        </p>

        <button type="button" className="primary" style={{ width: "100%", padding: "0.75rem" }} onClick={onDismiss}>
          Get Started
        </button>
      </div>
    </div>
  );
}
