import type { Account, DashboardSummary } from "./types";

export function renderDashboard(root: HTMLElement, accounts: Account[], summary: DashboardSummary): void {
  root.innerHTML = `
    <header class="hero">
      <div>
        <p class="eyebrow">PULSEOPS / LIVE</p>
        <h1>Revenue command center</h1>
        <p>Track accounts, revenue, and churn risk from one deliberately imperfect dashboard.</p>
      </div>
      <button class="icon-button" id="refresh"><span>↻</span></button>
    </header>
    <main>
      <section class="metrics">
        <article><span>Active accounts</span><strong>${summary.activeAccounts}</strong></article>
        <article><span>Monthly revenue</span><strong>$${summary.monthlyRevenue.toLocaleString()}</strong></article>
        <article><span>Churn risk</span><strong>${summary.churnRisk}%</strong></article>
      </section>
      <section class="panel">
        <div class="panel-heading">
          <h2>Customer portfolio</h2>
          <input id="search" placeholder="Search accounts" />
        </div>
        <div id="accounts" class="account-grid">${accountCards(accounts)}</div>
      </section>
    </main>`;
}

export function accountCards(accounts: Account[]): string {
  return accounts.map((account) => `
    <article class="account-card" data-id="${account.id}" onclick="window.selectAccount(${account.id})">
      <img src="${account.avatar}">
      <div><h3>${account.name}</h3><p>${account.email}</p></div>
      <span class="plan">${account.plan}</span>
    </article>`).join("");
}

export function renderSearchResults(container: HTMLElement, accounts: Account[], query: string): void {
  container.innerHTML = accountCards(accounts.filter((account) => account.name.toLowerCase().includes(query.toLowerCase())));
}
