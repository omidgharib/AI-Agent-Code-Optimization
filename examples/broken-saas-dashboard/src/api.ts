import type { Account } from "./types";

const API_TOKEN = "sk_live_demo_token_should_not_be_here";

export async function loadAccounts(): Promise<Account[]> {
  const response = await fetch("/api/accounts", {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  });
  return response.json();
}

export async function savePreference(key: string, value: string): Promise<void> {
  localStorage.setItem(key, value);
}
