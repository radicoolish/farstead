import type { ReactNode } from "react";

/** Consistent panel chrome for every chart in the app: a titled card with
 * a fixed-height plot area. Mirrors the "Income / Expenses / 401k
 * Withdrawal / Social Security / Surplus" panel grid from app.py's
 * render_household_cash_flow_charts, reused everywhere a titled chart
 * appears. */
export function ChartCard({
  title,
  subtitle,
  height = 300,
  children,
}: {
  title: string;
  /** A one-line description of what the chart shows — most useful once a
   * page only shows one chart at a time (a tab or dropdown selection),
   * where the title alone no longer has neighboring charts for context. */
  subtitle?: string;
  height?: number;
  children: ReactNode;
}) {
  return (
    <div className="card" style={{ minWidth: 0 }}>
      <h4 style={{ margin: subtitle ? "0 0 0.15rem" : "0 0 0.75rem" }}>{title}</h4>
      {subtitle && (
        <p className="caption" style={{ margin: "0 0 0.75rem" }}>
          {subtitle}
        </p>
      )}
      <div style={{ width: "100%", height }}>{children}</div>
    </div>
  );
}

/** Responsive grid for chart panels. By default, auto-fits as many
 * columns as fit (>=320px each), wrapping freely. Pass `fixedColumns` to
 * pin the column count instead (with its own narrower-screen fallbacks in
 * index.css's .chart-grid-fixed-N) — used where landing in a predictable
 * number of rows matters more than each chart getting maximum width. */
export function ChartGrid({ children, fixedColumns }: { children: ReactNode; fixedColumns?: number }) {
  if (fixedColumns) {
    return <div className={`chart-grid-fixed chart-grid-fixed-${fixedColumns}`}>{children}</div>;
  }
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
