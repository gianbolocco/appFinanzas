import { describe, it, expect } from "vitest";
import { todayLocal, monthStartLocal, monthEndLocal, addMonthsIso, addCadenceIso } from "./dates";

describe("todayLocal", () => {
  it("usa la fecha local, no UTC", () => {
    // 24/08/2026 22:30 en UTC-3 es el 25/08 en UTC.
    // El usuario cargó el gasto el 24, así que debe decir 24.
    const localNight = new Date(2026, 7, 24, 22, 30, 0);
    expect(todayLocal(localNight)).toBe("2026-08-24");
  });

  it("rellena mes y dia con cero", () => {
    expect(todayLocal(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("monthStartLocal / monthEndLocal", () => {
  it("devuelve el primero y el ultimo dia del mes", () => {
    const d = new Date(2026, 7, 24, 22, 30, 0);
    expect(monthStartLocal(d)).toBe("2026-08-01");
    expect(monthEndLocal(d)).toBe("2026-08-31");
  });

  it("maneja febrero bisiesto", () => {
    const d = new Date(2028, 1, 10);
    expect(monthEndLocal(d)).toBe("2028-02-29");
  });
});

describe("addMonthsIso", () => {
  it("suma meses", () => {
    expect(addMonthsIso("2026-08-24", 1)).toBe("2026-09-24");
  });

  it("no desborda al mes siguiente cuando el dia no existe", () => {
    // 31 de enero + 1 mes debe ser 28 de febrero, no 3 de marzo.
    expect(addMonthsIso("2026-01-31", 1)).toBe("2026-02-28");
  });
});

describe("addCadenceIso", () => {
  it("avanza segun la cadencia", () => {
    expect(addCadenceIso("2026-08-24", "weekly")).toBe("2026-08-31");
    expect(addCadenceIso("2026-08-24", "monthly")).toBe("2026-09-24");
    expect(addCadenceIso("2026-08-24", "quarterly")).toBe("2026-11-24");
    expect(addCadenceIso("2026-08-24", "yearly")).toBe("2027-08-24");
  });
});
