import { assertEquals, assertThrows } from "@std/assert";
import { extractTextExpense } from "./text-expense-extractor.ts";

Deno.test("extracts a complete lunch expense in Bogota time", () => {
  assertEquals(
    extractTextExpense("Almuerzo 35000", "2026-07-18T02:30:00.000Z"),
    {
      monto: 35000,
      fecha_gasto: "2026-07-17",
      categoria: "Alimentación",
      descripcion: "Almuerzo",
      metodo_pago: null,
      confianza: 0.9,
    },
  );
});

Deno.test("extracts dotted and mil amounts with known categories", () => {
  assertEquals(
    extractTextExpense("Uber 45.000", "2026-07-17T15:00:00.000Z"),
    {
      monto: 45000,
      fecha_gasto: "2026-07-17",
      categoria: "Transporte",
      descripcion: "Uber",
      metodo_pago: null,
      confianza: 0.9,
    },
  );
  assertEquals(
    extractTextExpense("Mercado 20 mil", "2026-07-17T15:00:00.000Z").monto,
    20000,
  );
});

Deno.test("uses the previous Bogota date when the message says ayer", () => {
  assertEquals(
    extractTextExpense("Ayer pagué 45.000 de Uber", "2026-07-18T02:30:00.000Z"),
    {
      monto: 45000,
      fecha_gasto: "2026-07-16",
      categoria: "Transporte",
      descripcion: "Ayer pagué de Uber",
      metodo_pago: null,
      confianza: 0.9,
    },
  );
});

Deno.test("returns an incomplete extraction when the amount is missing", () => {
  assertEquals(
    extractTextExpense("Almuerzo", "2026-07-17T15:00:00.000Z").monto,
    null,
  );
  assertEquals(
    extractTextExpense("Cena 35,50", "2026-07-17T15:00:00.000Z").monto,
    null,
  );
});

Deno.test("rejects oversized or invalid input", () => {
  assertThrows(() => extractTextExpense("", "2026-07-17T15:00:00.000Z"));
  assertThrows(() =>
    extractTextExpense("x".repeat(4001), "2026-07-17T15:00:00.000Z")
  );
  assertThrows(() => extractTextExpense("Cena 10", "invalid"));
});
