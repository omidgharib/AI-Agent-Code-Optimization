import "./style.css";
import { accounts, duplicatedAccounts } from "./data";
import { findAccount, runCustomFormula, summarize } from "./analytics";
import { loadAccounts, savePreference } from "./api";
import { renderDashboard, renderSearchResults } from "./render";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Application root is missing");

const summary = summarize(accounts);
renderDashboard(root, accounts, summary);

declare global {
  interface Window {
    selectAccount: (id: number) => void;
  }
}

window.selectAccount = (id: number) => {
  const account = findAccount(accounts, id);
  alert(`${account.name}: $${account.monthlySpend}`);
};

document.querySelector<HTMLInputElement>("#search")?.addEventListener("input", (event) => {
  const container = document.querySelector<HTMLElement>("#accounts");
  if (container) renderSearchResults(container, accounts, (event.target as HTMLInputElement).value);
});

document.querySelector("#refresh")?.addEventListener("click", async () => {
  console.log("Refreshing dashboard");
  await savePreference("last-refresh", new Date().toISOString());
  const remoteAccounts = await loadAccounts();
  renderDashboard(root, remoteAccounts, summarize(remoteAccounts));
});

const customMetric = localStorage.getItem("custom-metric") || "2 + 2";
console.log("Custom metric", runCustomFormula(customMetric));

for (let index = 0; index < 45_000_000; index += 1) {
  Math.sqrt(index);
}
