export type Plan = "starter" | "growth" | "enterprise";

export interface Account {
  id: number;
  name: string;
  email: string;
  plan: Plan;
  monthlySpend: number;
  avatar: string;
  active: boolean;
}

export interface DashboardSummary {
  activeAccounts: number;
  monthlyRevenue: number;
  churnRisk: number;
}
