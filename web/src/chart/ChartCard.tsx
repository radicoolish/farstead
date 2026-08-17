import type { ReactNode } from "react";

/** Consistent panel chrome for every chart in the app: a titled card with
 * a fixed-height plot area. Mirrors the "Income / Expenses / 401k
 * Withdrawal / Social Security / Surplus" panel grid from app.py's
 * render_household_cash_flow_charts, reused everywhere a titled chart
 * appears. */
export function ChartCard({
  title,
  height = 300,
  children,
}: {
  title: string;
  height?: number;
  children: ReactNode;
}) {
  return (
    <div className="card" style={{ minWidth: 0 }}>
      <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>{title}</h4>
      <div style={{ width: "100%", height }}>{children}</div>
    </div>
  );
}

/** Responsive grid for chart panels — 2 columns on wide screens, 1 on
 * narrow, matching the app's 2x2 (or 2x2+1) chart layouts. */
export function ChartGrid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: "1rem",
      }}
    >
      {children}
    </div>
  );
}
