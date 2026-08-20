import type { WithdrawalRate } from "../calc";

/** UI-side state for a %-or-$ withdrawal rate control — keeps both the
 * last-entered percent and dollar value in memory even while the other
 * mode is active, so switching back and forth doesn't lose what was
 * typed. Only the value matching the current `mode` is actually used in
 * calculations (see `resolveWithdrawalRate`). */
export interface WithdrawalRateState {
  mode: "percent" | "dollar";
  percent: number;
  dollar: number;
}

export function defaultWithdrawalRateState(percent = 4, dollar = 40000): WithdrawalRateState {
  return { mode: "percent", percent, dollar };
}

/** Collapses a WithdrawalRateState down to just the active value, in the
 * shape the calc layer actually wants. */
export function resolveWithdrawalRate(state: WithdrawalRateState): WithdrawalRate {
  return { mode: state.mode, value: state.mode === "percent" ? state.percent : state.dollar };
}

/** Rebuilds a WithdrawalRateState from a JSON export's settings object —
 * tolerates files saved before the %-or-$ toggle existed (no
 * withdrawalMode/withdrawalDollar, just a plain withdrawalRatePct), which
 * import as percent mode. Values are clamped to the same ranges the UI
 * inputs enforce. */
export function withdrawalRateFromSettings(settings: {
  withdrawalRatePct?: number | null;
  withdrawalMode?: "percent" | "dollar" | null;
  withdrawalDollar?: number | null;
}): WithdrawalRateState | null {
  if (settings.withdrawalRatePct == null) return null;
  const percent = Math.max(0, Math.min(20, settings.withdrawalRatePct));
  const dollar = settings.withdrawalDollar != null ? Math.max(0, settings.withdrawalDollar) : defaultWithdrawalRateState().dollar;
  const mode = settings.withdrawalMode === "dollar" ? "dollar" : "percent";
  return { mode, percent, dollar };
}
