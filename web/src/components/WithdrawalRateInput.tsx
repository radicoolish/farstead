import { useId } from "react";
import { NumberField } from "./NumberField";
import type { WithdrawalRateState } from "../state/withdrawalRate";

/** A withdrawal rate that can be entered as a percent of balance or a
 * fixed dollar amount — a mode toggle next to the active field. Switching
 * modes doesn't lose what was typed in the other one (see
 * WithdrawalRateState). */
export function WithdrawalRateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: WithdrawalRateState;
  onChange: (next: WithdrawalRateState) => void;
}) {
  const uid = useId();

  return (
    <div className="field" style={{ maxWidth: 280 }}>
      <label htmlFor={uid}>{label}</label>
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <div style={{ display: "flex", flex: "none" }}>
          <button
            type="button"
            className={value.mode === "percent" ? "primary" : undefined}
            style={{ borderRadius: "7px 0 0 7px", padding: "0.5rem 0.75rem" }}
            onClick={() => onChange({ ...value, mode: "percent" })}
            aria-pressed={value.mode === "percent"}
          >
            %
          </button>
          <button
            type="button"
            className={value.mode === "dollar" ? "primary" : undefined}
            style={{ borderRadius: "0 7px 7px 0", padding: "0.5rem 0.75rem", marginLeft: -1 }}
            onClick={() => onChange({ ...value, mode: "dollar" })}
            aria-pressed={value.mode === "dollar"}
          >
            $
          </button>
        </div>
        {value.mode === "percent" ? (
          <NumberField
            id={uid}
            min={0}
            max={20}
            step="any"
            value={value.percent}
            onChange={(v) => onChange({ ...value, percent: v })}
          />
        ) : (
          <NumberField id={uid} min={0} step="any" value={value.dollar} onChange={(v) => onChange({ ...value, dollar: v })} />
        )}
      </div>
      <p className="caption" style={{ marginTop: "0.3rem" }}>
        {value.mode === "percent" ? "% of the 401(k) balance withdrawn each year." : "A fixed dollar amount withdrawn each year."}
      </p>
    </div>
  );
}
