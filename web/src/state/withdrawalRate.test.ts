import { describe, expect, it } from "vitest";
import { resolveWithdrawalRate, withdrawalRateFromSettings } from "./withdrawalRate";

describe("resolveWithdrawalRate", () => {
  it("uses the percent value when mode is percent, ignoring dollar", () => {
    expect(resolveWithdrawalRate({ mode: "percent", percent: 4, dollar: 99999 })).toEqual({ mode: "percent", value: 4 });
  });

  it("uses the dollar value when mode is dollar, ignoring percent", () => {
    expect(resolveWithdrawalRate({ mode: "dollar", percent: 4, dollar: 50000 })).toEqual({ mode: "dollar", value: 50000 });
  });
});

describe("withdrawalRateFromSettings", () => {
  it("returns null when there's no withdrawal data at all", () => {
    expect(withdrawalRateFromSettings({})).toBeNull();
  });

  it("imports a pre-toggle export (percent only) as percent mode", () => {
    const result = withdrawalRateFromSettings({ withdrawalRatePct: 5 });
    expect(result).toEqual({ mode: "percent", percent: 5, dollar: 40000 });
  });

  it("imports a post-toggle export in dollar mode with both values intact", () => {
    const result = withdrawalRateFromSettings({ withdrawalRatePct: 5, withdrawalMode: "dollar", withdrawalDollar: 60000 });
    expect(result).toEqual({ mode: "dollar", percent: 5, dollar: 60000 });
  });

  it("clamps an out-of-range percent to [0, 20]", () => {
    expect(withdrawalRateFromSettings({ withdrawalRatePct: 999 })?.percent).toBe(20);
    expect(withdrawalRateFromSettings({ withdrawalRatePct: -5 })?.percent).toBe(0);
  });

  it("clamps a negative dollar amount to 0", () => {
    expect(withdrawalRateFromSettings({ withdrawalRatePct: 4, withdrawalDollar: -1000 })?.dollar).toBe(0);
  });
});
