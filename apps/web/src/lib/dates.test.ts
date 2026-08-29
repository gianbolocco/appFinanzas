import { describe, it, expect } from "vitest";

import {
  todayLocal,
  monthStartLocal,
  monthEndLocal,
  monthEndOfIso,
  addMonthsIso,
  addCadenceIso,
} from "./dates";

// Los instantes se fijan en UTC a propósito: si el test construyera la fecha con
// componentes locales, pasaría en una máquina argentina y fallaría en CI, que
// corre en UTC — que es exactamente el bug que estas funciones tienen que evitar.
describe("todayLocal", () => {
  it("usa la zona del usuario, no la del proceso", () => {
    // 01:30 UTC del 25 es 22:30 del 24 en Buenos Aires.
    expect(todayLocal(new Date("2026-08-25T01:30:00Z"))).toBe("2026-08-24");
  });

  it("rellena mes y día con cero", () => {
    expect(todayLocal(new Date("2026-01-05T15:00:00Z"))).toBe("2026-01-05");
  });
});

describe("monthStartLocal / monthEndLocal", () => {
  it("devuelve el primero y el último día del mes", () => {
    const d = new Date("2026-08-24T15:00:00Z");
    expect(monthStartLocal(d)).toBe("2026-08-01");
    expect(monthEndLocal(d)).toBe("2026-08-31");
  });

  it("no adelanta el mes en la última noche", () => {
    // 02:00 UTC del 1/9 son las 23:00 del 31/8 en Buenos Aires: sigue siendo agosto.
    const d = new Date("2026-09-01T02:00:00Z");
    expect(monthStartLocal(d)).toBe("2026-08-01");
    expect(monthEndLocal(d)).toBe("2026-08-31");
  });

  it("maneja febrero bisiesto", () => {
    expect(monthEndOfIso("2028-02-10")).toBe("2028-02-29");
    expect(monthEndOfIso("2027-02-10")).toBe("2027-02-28");
  });
});

describe("addMonthsIso", () => {
  it("suma meses", () => {
    expect(addMonthsIso("2026-08-24", 1)).toBe("2026-09-24");
  });

  it("resta meses cruzando el año", () => {
    expect(addMonthsIso("2026-08-01", -11)).toBe("2025-09-01");
  });

  it("no desborda al mes siguiente cuando el día no existe", () => {
    expect(addMonthsIso("2026-01-31", 1)).toBe("2026-02-28");
  });
});

describe("addCadenceIso", () => {
  it("avanza según la cadencia", () => {
    expect(addCadenceIso("2026-08-24", "weekly")).toBe("2026-08-31");
    expect(addCadenceIso("2026-08-24", "monthly")).toBe("2026-09-24");
    expect(addCadenceIso("2026-08-24", "quarterly")).toBe("2026-11-24");
    expect(addCadenceIso("2026-08-24", "yearly")).toBe("2027-08-24");
  });
});
