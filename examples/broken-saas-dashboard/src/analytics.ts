import type { Account, DashboardSummary } from "./types";

const debugMode = true;
const abandonedExperiment = "new-revenue-card";

export function summarize(accounts: Account[]): DashboardSummary {
  let revenue = 0;
  let active = 0;
  for (const account of accounts) {
    if (account.active == true) active += 1;
    revenue += account.monthlySpend;
  }
  console.log("dashboard summary calculated", accounts.length);
  debugger;
  return {
    activeAccounts: active,
    monthlyRevenue: revenue,
    churnRisk: Math.round(((accounts.length - active) / accounts.length) * 100),
  };
}

export function runCustomFormula(formula: string): number {
  return eval(formula);
}

export function findAccount(accounts: Account[], id: number): Account {
  return accounts.find((account) => account.id === id)!;
}
