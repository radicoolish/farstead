import { createContext, useContext, useState, type ReactNode } from "react";
import { usePeople } from "../hooks/usePeople";
import { useExpenses } from "../hooks/useExpenses";
import { calculateAge, EXPENSE_HORIZON_AGE } from "../calc";
import { defaultWithdrawalRateState, type WithdrawalRateState } from "./withdrawalRate";

type AppData = ReturnType<typeof usePeople> &
  ReturnType<typeof useExpenses> & {
    /** Shared "Current Age (for this projection)" — lives in the
     * Household Expenses section, but the Simulator reads the same value
     * rather than having its own, since that age also drives the expense
     * inflation math: letting it diverge would quietly break "expenses
     * stay fixed" in the Simulator. Mirrors app.py's session_state
     * expenses_current_age. */
    currentAge: number;
    setCurrentAge: (age: number) => void;
    /** The household's real 401(k) withdrawal rate, set in the Household
     * Expenses section — the Simulator has its own independent rate on
     * top of this (that one only affects 401(k) withdrawals, not
     * expenses, so there's no equivalent correctness reason to share it). */
    withdrawalRate: WithdrawalRateState;
    setWithdrawalRate: (rate: WithdrawalRateState) => void;
  };

const AppDataContext = createContext<AppData | null>(null);

/** Single source of truth for people + expenses + the couple of shared
 * projection settings, used by every section. Each section previously
 * would have called usePeople()/useExpenses() independently, which works
 * for one mounted instance but silently diverges the moment two sections
 * need the same data at once. */
export function AppDataProvider({ children }: { children: ReactNode }) {
  const peopleApi = usePeople();
  const expensesApi = useExpenses();

  const defaultCurrentAge = peopleApi.people.length > 0 ? calculateAge(peopleApi.people[0].birthday) : 35;
  const [currentAge, setCurrentAge] = useState(() => Math.min(defaultCurrentAge, EXPENSE_HORIZON_AGE - 1));
  const [withdrawalRate, setWithdrawalRate] = useState<WithdrawalRateState>(() => defaultWithdrawalRateState());

  const value: AppData = { ...peopleApi, ...expensesApi, currentAge, setCurrentAge, withdrawalRate, setWithdrawalRate };
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within an AppDataProvider");
  return ctx;
}
