import type { Expense } from "../calc";
import { StatTile } from "./StatTile";

/** One expense's summary card — the type as a heading, with amount and
 * timing/inflation (or remaining term, for a loan) broken out as labeled
 * values below, mirroring PersonBalanceCard's dense stat-tile grid rather
 * than a single dense caption string. */
export function ExpenseCard({ expense, onRemove }: { expense: Expense; onRemove: () => void }) {
  return (
    <div className="card">
      <div className="card-row" style={{ marginBottom: "0.6rem" }}>
        <strong>{expense.type}</strong>
        <button type="button" className="danger" onClick={onRemove}>
          Remove
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "0.75rem" }}>
        <StatTile dense label="Amount" value={`$${expense.monthlyAmount.toLocaleString("en-US")}/mo`} />
        {expense.isLoan ? (
          <StatTile dense label="Years Remaining" value={expense.remainingTermYears ?? 0} />
        ) : (
          <>
            <StatTile dense label="Timing" value={expense.isPerpetuity ? "Ongoing" : `Ages ${expense.startAge}–${expense.stopAge}`} />
            <StatTile dense label="Inflation" value={expense.applyInflation ? `${expense.inflationRate.toFixed(1)}%` : "None"} />
          </>
        )}
      </div>
    </div>
  );
}
