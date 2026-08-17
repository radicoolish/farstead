import { formatCompactCurrency, projectBalance, type Person } from "../calc";

/** Compact row of Base + scenario projected balances at retirement, with a
 * B/(W) dollar variance vs. Base under each scenario. Mirrors app.py's
 * render_totals_row. */
export function TotalsRow({ person }: { person: Person }) {
  const baseRows = projectBalance(person);
  const baseBalance = baseRows[baseRows.length - 1].balance;
  const baseAge = baseRows[baseRows.length - 1].age;

  const entries: Array<{ name: string; balance: number; diff: number | null; endAge: number }> = [
    { name: "Base", balance: baseBalance, diff: null, endAge: baseAge },
  ];
  for (const scenario of person.scenarios) {
    const overrides =
      scenario.field === "incomeChange" ? { incomeChange: scenario.value as never } : { [scenario.field]: scenario.value };
    const rows = projectBalance(person, overrides);
    const balance = rows[rows.length - 1].balance;
    entries.push({ name: scenario.name, balance, diff: balance - baseBalance, endAge: rows[rows.length - 1].age });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${entries.length}, 1fr)`, gap: "0.5rem" }}>
      {entries.map((entry) => {
        const isBetter = entry.diff !== null && entry.diff >= 0;
        return (
          <div key={entry.name} style={{ textAlign: "center", lineHeight: 1.3, padding: "2px 1px" }}>
            <div
              className="caption"
              style={{ fontSize: "0.68rem", opacity: 0.65, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              title={entry.name}
            >
              {entry.name}
            </div>
            <div
              style={{ fontSize: "1rem", fontWeight: 700, whiteSpace: "nowrap" }}
              title={`$${entry.balance.toLocaleString("en-US", { maximumFractionDigits: 0 })} at age ${entry.endAge}`}
            >
              {formatCompactCurrency(entry.balance)}
            </div>
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 600,
                color: entry.diff === null ? "inherit" : isBetter ? "var(--success)" : "var(--danger)",
                whiteSpace: "nowrap",
              }}
            >
              {entry.diff === null
                ? " "
                : `${isBetter ? "▲" : "▼"} ${formatCompactCurrency(Math.abs(entry.diff))} ${isBetter ? "B" : "(W)"}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
