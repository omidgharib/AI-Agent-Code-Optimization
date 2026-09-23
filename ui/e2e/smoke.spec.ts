import { test, expect } from "@playwright/test";

test("dashboard loads with brand and audit form", async ({ page }) => {
  await page.goto("/code");
  await expect(page.locator(".brand strong")).toHaveText("AI Auditor");
  await expect(page.locator("[data-testid=project-path]")).toBeVisible();
  await expect(page.locator("[data-testid=start-audit]")).toBeVisible();
});

test("theme toggle switches to light theme and persists on reload", async ({ page }) => {
  await page.goto("/code");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.locator("[data-testid=theme-toggle]").click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.locator("[data-testid=theme-toggle]").click();
  await expect(html).toHaveAttribute("data-theme", "dark");
});

test("language toggle switches Persian (RTL) <-> English (LTR) and back", async ({ page }) => {
  await page.goto("/code");
  const html = page.locator("html");
  const initial = (await html.getAttribute("lang")) ?? "fa";
  const flipped = initial === "fa" ? "en" : "fa";
  await page.locator("[data-testid=language-toggle]").click();
  await expect(html).toHaveAttribute("lang", flipped);
  await expect(html).toHaveAttribute("dir", flipped === "fa" ? "rtl" : "ltr");
  await page.locator("[data-testid=language-toggle]").click();
  await expect(html).toHaveAttribute("lang", initial);
  await expect(html).toHaveAttribute("dir", initial === "fa" ? "rtl" : "ltr");
});

test("folder browser dialog opens and closes", async ({ page }) => {
  await page.goto("/code");
  await page.locator("[data-testid=folder-browser]").click();
  const dialog = page.locator("[data-testid=folder-dialog]");
  await expect(dialog).toBeVisible();
  await dialog.locator("header button").first().click();
  await expect(dialog).not.toBeVisible();
});

test("invalid project path surfaces a validation error", async ({ page }) => {
  await page.goto("/code");
  await page.locator("[data-testid=project-path]").fill("C:\\definitely-not-a-real-project-123456");
  await page.locator("[data-testid=start-audit]").click();
  const error = page.locator("[data-testid=form-error]");
  await expect(error).toBeVisible();
});