import { useId, useRef, useState } from "react";
import { estimateEffectiveTaxRate, FILING_STATUSES, STATE_TAX_RATES, type FilingStatus } from "../calc";
import { Popover } from "./Popover";

const STATE_NAMES = Object.keys(STATE_TAX_RATES).sort();

interface TaxRateEstimatorProps {
  annualSalary: number;
  contributionPct: number;
  hsaMonthly: number;
  onEstimate: (ratePct: number) => void;
}

/** "Estimate my rate" — approximate federal + state effective rate, for
 * planning only, not tax advice. Mirrors the Streamlit app's tax estimator
 * popover. */
export function TaxRateEstimator({
  annualSalary,
  contributionPct,
  hsaMonthly,
  onEstimate,
}: TaxRateEstimatorProps) {
  const [state, setState] = useState(STATE_NAMES[0]);
  const [filingStatus, setFilingStatus] = useState<FilingStatus>(FILING_STATUSES[0]);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const uid = useId();

  function handleEstimate() {
    const pretaxReductions = (annualSalary * contributionPct) / 100 + hsaMonthly * 12;
    const estimated = estimateEffectiveTaxRate(state, filingStatus, annualSalary, pretaxReductions);
    onEstimate(Math.round(estimated * 10) / 10);
    if (detailsRef.current) detailsRef.current.open = false;
  }

  return (
    <Popover label="Estimate my rate" ref={detailsRef}>
      <p className="caption" style={{ marginTop: 0 }}>
        Approximate federal + state effective rate, for planning only — not tax advice.
      </p>
      <div className="field">
        <label htmlFor={`${uid}-state`}>State</label>
        <select id={`${uid}-state`} value={state} onChange={(e) => setState(e.target.value)}>
          {STATE_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${uid}-filing-status`}>Filing Status</label>
        <select
          id={`${uid}-filing-status`}
          value={filingStatus}
          onChange={(e) => setFilingStatus(e.target.value as FilingStatus)}
        >
          {FILING_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
      <button type="button" onClick={handleEstimate}>
        Estimate
      </button>
    </Popover>
  );
}
