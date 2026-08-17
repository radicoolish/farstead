import { useRef } from "react";
import { estimateMonthlySocialSecurity } from "../calc";
import { Popover } from "./Popover";

interface SocialSecurityEstimatorProps {
  annualSalary: number;
  birthday: string;
  claimAge: number;
  onEstimate: (monthlyBenefit: number) => void;
}

/** "Estimate my benefit" — rough approximation using salary as a stand-in
 * for a full 35-year earnings history, for planning only, not an official
 * SSA estimate. Mirrors the Streamlit app's Social Security estimator
 * popover. */
export function SocialSecurityEstimator({
  annualSalary,
  birthday,
  claimAge,
  onEstimate,
}: SocialSecurityEstimatorProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function handleEstimate() {
    const estimated = estimateMonthlySocialSecurity(annualSalary, birthday, claimAge);
    onEstimate(Math.round(estimated));
    if (detailsRef.current) detailsRef.current.open = false;
  }

  return (
    <Popover label="Estimate my benefit" ref={detailsRef}>
      <p className="caption" style={{ marginTop: 0 }}>
        Rough approximation using your salary as a stand-in for a full 35-year earnings history,
        for planning only — not an official SSA estimate.
      </p>
      <button type="button" onClick={handleEstimate}>
        Estimate
      </button>
    </Popover>
  );
}
