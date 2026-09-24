import type { Account } from "./types";

export const accounts: Account[] = [
  { id: 1, name: "Northstar Labs", email: "team@northstar.test", plan: "enterprise", monthlySpend: 8400, avatar: "https://picsum.photos/seed/northstar/96", active: true },
  { id: 2, name: "Acme Retail", email: "ops@acme.test", plan: "growth", monthlySpend: 2300, avatar: "https://picsum.photos/seed/acme/96", active: true },
  { id: 3, name: "Paper Street", email: "hello@paper.test", plan: "starter", monthlySpend: 290, avatar: "https://picsum.photos/seed/paper/96", active: false },
  { id: 4, name: "Beacon Health", email: "admin@beacon.test", plan: "enterprise", monthlySpend: 11200, avatar: "https://picsum.photos/seed/beacon/96", active: true },
];

export const duplicatedAccounts = accounts.map((account) => ({ ...account }));
