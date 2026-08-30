import { test, expect } from "@playwright/test";

test("public home links to login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Registra tus gastos/i })).toBeVisible();
  await page.getByRole("link", { name: /Entrar al dashboard/i }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: /Iniciar sesión/i })).toBeVisible();
});

test("dashboard and history require authentication", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/historial");
  await expect(page).toHaveURL(/\/login$/);
});

test("webhook rejects an unsigned request", async ({ request }) => {
  const response = await request.post("/api/webhooks/whatsapp", { data: { event: "messages.upsert" } });
  expect(response.status()).toBe(401);
});
