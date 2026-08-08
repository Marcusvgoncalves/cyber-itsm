import { test, expect } from "@playwright/test";

test.describe("Tema claro/escuro", () => {
  test("toggle aplica .dark, persiste e volta para claro", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.locator("html")).not.toHaveClass(/dark/);

    const toggle = page.getByRole("button", { name: "Ativar tema escuro" });
    await expect(toggle).toBeVisible();
    await toggle.click();

    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByRole("button", { name: "Ativar tema claro" })).toBeVisible();

    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByRole("button", { name: "Ativar tema claro" })).toBeVisible();

    await page.getByRole("button", { name: "Ativar tema claro" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(page.getByRole("button", { name: "Ativar tema escuro" })).toBeVisible();

    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("sem preferência salva, segue o sistema", async ({ context, page }) => {
    await context.addInitScript(() => {
      localStorage.removeItem("cyberitsm-theme");
    });
    const prefersDark = await page.evaluate(
      () => window.matchMedia("(prefers-color-scheme: dark)").matches
    );
    await page.goto("/dashboard");
    const htmlClass = await page.locator("html").getAttribute("class");
    expect(!!htmlClass?.includes("dark")).toBe(prefersDark);
  });
});
