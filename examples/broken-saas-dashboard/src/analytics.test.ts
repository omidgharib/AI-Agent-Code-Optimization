import { describe, expect, it } from "vitest";
import { accounts } from "./data";
import { findAccount, summarize } from "./analytics";

describe("dashboard analytics", () => {
  it("summarizes active accounts and revenue", () => {
    expect(summarize(accounts)).toEqual({
      activeAccounts: 3,
      monthlyRevenue: 22190,
      churnRisk: 25,
    });
  });

  it("returns undefined for an unknown account", () => {
    expect(findAccount(accounts, 999)).toBeUndefined();
  });
});
