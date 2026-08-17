import { useEffect, useId, useState } from "react";
import { EXPENSE_HORIZON_AGE, EXPENSE_TYPES, LOAN_EXPENSE_TYPES, type ExpenseType } from "../calc";
import type { ExpenseDraft } from "../hooks/useExpenses";
import { useAppData } from "../state/AppDataContext";

interface ExpenseFormProps {
  currentAge: number;
  onAdd: (draft: ExpenseDraft) => void;
}

/** Add-an-expense form: loans (fixed payment + remaining term) vs.
 * recurring costs (perpetuity, or a start/stop age window with optional
 * inflation). Property Taxes defaults to starting when the mortgage is
 * paid off; Health Insurance defaults to bridging the gap between
 * employer coverage ending at retirement and Medicare eligibility at 65
 * (or warns there's no gap to insure, for a retirement age of 65+).
 * Mirrors app.py's Add an Expense form in Section 3. */
export function ExpenseForm({ currentAge, onAdd }: ExpenseFormProps) {
  const uid = useId();
  const { expenses, people } = useAppData();
  const [type, setType] = useState<ExpenseType>(EXPENSE_TYPES[0]);
  const isLoanType = LOAN_EXPENSE_TYPES.has(type);

  const [monthlyAmount, setMonthlyAmount] = useState(0);
  const [remainingTermYears, setRemainingTermYears] = useState(15);
  const [isPerpetuity, setIsPerpetuity] = useState(true);
  const [startAge, setStartAge] = useState(currentAge);
  const [stopAge, setStopAge] = useState(Math.min(currentAge + 10, 100));
  const [applyInflation, setApplyInflation] = useState(true);
  const [inflationRate, setInflationRate] = useState(3);

  const mortgagePayoffAge = (() => {
    if (type !== "Property Taxes") return null;
    const terms = expenses
      .filter((e) => e.type === "Mortgage" && e.isLoan && e.remainingTermYears != null)
      .map((e) => e.remainingTermYears!);
    if (terms.length === 0) return null;
    return Math.min(currentAge + Math.max(...terms), 100);
  })();
  const retirementAgeRef = type === "Health Insurance" && people.length > 0 ? people[0].retirementAge : null;

  // Only re-seed the perpetuity/start/stop defaults the first render after
  // the expense type changes — otherwise every rerun (e.g. editing the
  // monthly amount) would stomp a value the user deliberately changed
  // afterward.
  useEffect(() => {
    if (mortgagePayoffAge !== null) {
      setIsPerpetuity(false);
      setStartAge(mortgagePayoffAge);
      setStopAge(EXPENSE_HORIZON_AGE);
    } else if (retirementAgeRef !== null) {
      setIsPerpetuity(false);
      setStartAge(retirementAgeRef);
      setStopAge(retirementAgeRef < 65 ? 65 : Math.max(1, retirementAgeRef - 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  let startHelp: string | null = null;
  let stopHelp: string | null = null;
  if (mortgagePayoffAge !== null) {
    startHelp = `Defaults to age ${mortgagePayoffAge}, when your mortgage is paid off — property taxes are assumed to only show up as a separate cost after that.`;
  } else if (retirementAgeRef !== null) {
    if (retirementAgeRef < 65) {
      startHelp = `Defaults to your retirement age (${retirementAgeRef}) — employer health coverage typically ends at retirement.`;
      stopHelp = "Defaults to 65, when Medicare eligibility begins.";
    } else {
      startHelp = `Defaults to a zero-length window since Medicare covers you immediately at retirement (age ${retirementAgeRef}).`;
    }
  }

  function handleAdd() {
    onAdd({
      type,
      monthlyAmount,
      isLoan: isLoanType,
      remainingTermYears: isLoanType ? remainingTermYears : undefined,
      isPerpetuity: isLoanType ? true : isPerpetuity,
      startAge: !isLoanType && !isPerpetuity ? startAge : undefined,
      stopAge: !isLoanType && !isPerpetuity ? stopAge : undefined,
      applyInflation: isLoanType ? false : applyInflation,
      inflationRate: isLoanType ? 0 : applyInflation ? inflationRate : 0,
    });
  }

  return (
    <div>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`${uid}-type`}>Expense Type</label>
          <select id={`${uid}-type`} value={type} onChange={(e) => setType(e.target.value as ExpenseType)}>
            {EXPENSE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${uid}-amount`}>{isLoanType ? "Current Monthly Payment ($)" : "Monthly Value ($)"}</label>
          <input
            id={`${uid}-amount`}
            type="number"
            min={0}
            step="any"
            value={monthlyAmount}
            onChange={(e) => setMonthlyAmount(Number(e.target.value))}
          />
        </div>
      </div>

      {isLoanType ? (
        <>
          <div className="field">
            <label htmlFor={`${uid}-term`}>Remaining Term (Years)</label>
            <input
              id={`${uid}-term`}
              type="number"
              min={0}
              max={50}
              value={remainingTermYears}
              onChange={(e) => setRemainingTermYears(Number(e.target.value))}
            />
          </div>
          <p className="caption">Loan payments are fixed (no inflation) and fall off automatically once the term ends.</p>
        </>
      ) : (
        <>
          {retirementAgeRef !== null && retirementAgeRef >= 65 && (
            <p
              className="caption"
              style={{ color: "var(--danger)", background: "var(--danger-soft)", padding: "0.5rem 0.75rem", borderRadius: 6 }}
            >
              Retirement age is {retirementAgeRef}, so Medicare coverage begins immediately at retirement —
              there's no coverage gap to insure. This defaults to a zero-length window (won't count toward
              your projection) unless you widen it.
            </p>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 400, marginBottom: "0.75rem" }}>
            <input type="checkbox" checked={isPerpetuity} onChange={(e) => setIsPerpetuity(e.target.checked)} />
            Perpetuity (runs the whole projection)
          </label>

          {!isPerpetuity && (
            <div className="field-row">
              <div className="field">
                <label htmlFor={`${uid}-start`}>Start Age</label>
                <input
                  id={`${uid}-start`}
                  type="number"
                  min={1}
                  max={100}
                  value={startAge}
                  onChange={(e) => setStartAge(Number(e.target.value))}
                />
                {startHelp && <p className="caption">{startHelp}</p>}
              </div>
              <div className="field">
                <label htmlFor={`${uid}-stop`}>Stop Age</label>
                <input
                  id={`${uid}-stop`}
                  type="number"
                  min={1}
                  max={100}
                  value={stopAge}
                  onChange={(e) => setStopAge(Number(e.target.value))}
                />
                {stopHelp && <p className="caption">{stopHelp}</p>}
              </div>
            </div>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 400, marginBottom: "0.5rem" }}>
            <input type="checkbox" checked={applyInflation} onChange={(e) => setApplyInflation(e.target.checked)} />
            Apply Inflation
          </label>
          {applyInflation && (
            <div className="field" style={{ maxWidth: 220 }}>
              <label htmlFor={`${uid}-inflation`}>Inflation Rate (%)</label>
              <input
                id={`${uid}-inflation`}
                type="number"
                min={0}
                max={20}
                step="any"
                value={inflationRate}
                onChange={(e) => setInflationRate(Number(e.target.value))}
              />
            </div>
          )}
        </>
      )}

      <button type="button" onClick={handleAdd} style={{ marginTop: "0.75rem" }}>
        Add Expense
      </button>
    </div>
  );
}
