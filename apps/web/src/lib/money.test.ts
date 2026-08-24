import { describe, it, expect } from "vitest";
import { convert, sumInBase, splitInstallments, installmentDates, dueThrough, type Rate } from "./money";

const rates: Rate[] = [
  { base: "USD", quote: "ARS", rate: 1200 },
  { base: "USD", quote: "EUR", rate: 0.9 },
];

describe("convert", () => {
  it("devuelve el mismo monto si la moneda no cambia", () => {
    expect(convert(100, "ARS", "ARS", rates)).toBe(100);
  });

  it("usa el rate directo", () => {
    expect(convert(2, "USD", "ARS", rates)).toBe(2400);
  });

  it("usa el rate inverso", () => {
    expect(convert(2400, "ARS", "USD", rates)).toBe(2);
  });

  it("triangula por USD cuando no hay rate directo", () => {
    // 1200 ARS -> 1 USD -> 0.9 EUR
    expect(convert(1200, "ARS", "EUR", rates)).toBeCloseTo(0.9, 6);
  });

  it("devuelve null cuando falta el rate, en vez de asumir 1", () => {
    expect(convert(100, "BRL", "ARS", [])).toBeNull();
  });
});

describe("sumInBase", () => {
  it("convierte antes de sumar", () => {
    const r = sumInBase(
      [
        { balance: 100000, currency: "ARS" },
        { balance: 100, currency: "USD" },
      ],
      "ARS",
      rates,
    );
    expect(r.total).toBe(220000);
    expect(r.partial).toBe(false);
  });

  it("marca el total como parcial si falta un rate", () => {
    const r = sumInBase(
      [
        { balance: 1000, currency: "ARS" },
        { balance: 50, currency: "BRL" },
      ],
      "ARS",
      rates,
    );
    expect(r.total).toBe(1000);
    expect(r.partial).toBe(true);
  });

  it("una lista vacia suma cero y no es parcial", () => {
    expect(sumInBase([], "ARS", rates)).toEqual({ total: 0, partial: false });
  });
});

describe("splitInstallments", () => {
  it("reparte sin perder centavos", () => {
    const parts = splitInstallments(100, 3);
    expect(parts).toHaveLength(3);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("pone la diferencia en la primera cuota", () => {
    expect(splitInstallments(100, 3)).toEqual([33.34, 33.33, 33.33]);
  });

  it("una sola cuota es el total", () => {
    expect(splitInstallments(4500, 1)).toEqual([4500]);
  });
});

describe("installmentDates", () => {
  it("genera una fecha por cuota, mes a mes", () => {
    expect(installmentDates("2026-08-24", 3)).toEqual(["2026-08-24", "2026-09-24", "2026-10-24"]);
  });
});

describe("dueThrough", () => {
  it("cuenta las cuotas ya vencidas incluyendo hoy", () => {
    const dates = ["2026-08-24", "2026-09-24", "2026-10-24"];
    expect(dueThrough(dates, "2026-08-24")).toBe(1);
    expect(dueThrough(dates, "2026-09-30")).toBe(2);
    expect(dueThrough(dates, "2026-12-01")).toBe(3);
  });

  it("es cero si la primera cuota todavia no vencio", () => {
    expect(dueThrough(["2026-09-01"], "2026-08-24")).toBe(0);
  });
});
