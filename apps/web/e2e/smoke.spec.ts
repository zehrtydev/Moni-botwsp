import { test, expect } from "@playwright/test";

test("public home links to login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Tus gastos, registrados por WhatsApp." })).toBeVisible();
  await expect(page.getByText(/Crear cuenta|Registrarse|Comenzar gratis/i)).toHaveCount(0);
  await page.getByRole("link", { name: "Iniciar sesión" }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: /Iniciar sesión/i })).toBeVisible();
  await expect(page.getByText(/Crear una cuenta|Registrarse/i)).toHaveCount(0);
});

test("private pages require authentication", async ({ page }) => {
  for (const route of ["/dashboard", "/historial", "/estadisticas", "/presupuestos"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("webhook rejects an unsigned request", async ({ request }) => {
  const response = await request.post("/api/webhooks/whatsapp", { data: { event: "messages.upsert" } });
  expect(response.status()).toBe(401);
});
