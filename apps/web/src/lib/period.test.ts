import { describe, expect, it } from "vitest";

import { monthPace, pctChange, resolvePeriod } from "./period";

// 15 de agosto de 2026: mes de 31 días, mitad de mes.
const NOW = new Date(2026, 7, 15);

describe("resolvePeriod", () => {
  it("por defecto toma el mes calendario en curso", () => {
    const p = resolvePeriod(undefined, NOW);
    expect(p.from).toBe("2026-08-01");
    expect(p.to).toBe("2026-08-31");
  });

  it("el período previo es del mismo largo, corrido hacia atrás", () => {
    const mes = resolvePeriod("mes", NOW);
    expect(mes.prevFrom).toBe("2026-07-01");
    expect(mes.prevTo).toBe("2026-07-31");

    const trimestre = resolvePeriod("trimestre", NOW);
    expect(trimestre.from).toBe("2026-06-01");
    expect(trimestre.prevFrom).toBe("2026-03-01");

    const anio = resolvePeriod("anio", NOW);
    expect(anio.from).toBe("2025-09-01");
    expect(anio.prevFrom).toBe("2024-09-01");
  });

  it("no compara el histórico completo contra nada", () => {
    const todo = resolvePeriod("todo", NOW);
    expect(todo.from).toBeUndefined();
    expect(todo.prevFrom).toBeUndefined();
  });
});

describe("monthPace", () => {
  it("proyecta el cierre según los días transcurridos", () => {
    const { day, daysInMonth, projected } = monthPace(15_000, NOW);
    expect(day).toBe(15);
    expect(daysInMonth).toBe(31);
    expect(projected).toBeCloseTo(31_000, 5);
  });
});

describe("pctChange", () => {
  it("no inventa un porcentaje cuando no hay base previa", () => {
    expect(pctChange(100, 0)).toBeNull();
  });

  it("calcula la variación", () => {
    expect(pctChange(120, 100)).toBe(20);
    expect(pctChange(80, 100)).toBe(-20);
  });
});
