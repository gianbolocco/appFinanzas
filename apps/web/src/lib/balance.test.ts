import { describe, expect, it } from "vitest";

import { movementsDelta, type BalanceTx } from "./balance";

const HOY = "2026-08-28";
const A = "cuenta-a";
const B = "cuenta-b";

function tx(over: Partial<BalanceTx>): BalanceTx {
  return {
    type: "expense",
    amount: 0,
    dest_amount: null,
    date: HOY,
    account_id: A,
    to_account_id: null,
    installment_number: null,
    is_installment_parent: false,
    ...over,
  };
}

describe("movementsDelta", () => {
  it("suma ingresos y resta gastos", () => {
    expect(movementsDelta([tx({ type: "income", amount: 1000 })], A, HOY)).toBe(1000);
    expect(movementsDelta([tx({ type: "expense", amount: 400 })], A, HOY)).toBe(-400);
  });

  it("la transferencia sale del origen y entra al destino en la moneda del destino", () => {
    // 100 USD desde A hacia B, que está en pesos: B recibe 145.000, no 100.
    const t = tx({ type: "transfer", amount: 100, dest_amount: 145_000, to_account_id: B });
    expect(movementsDelta([t], A, HOY)).toBe(-100);
    expect(movementsDelta([t], B, HOY)).toBe(145_000);
  });

  it("ignora el padre de una compra en cuotas", () => {
    const padre = tx({ amount: 60_000, is_installment_parent: true });
    expect(movementsDelta([padre], A, HOY)).toBe(0);
  });

  it("cuenta las cuotas vencidas y no las futuras", () => {
    const cuotas = [
      tx({ amount: 10_000, installment_number: 1, date: "2026-07-28" }),
      tx({ amount: 10_000, installment_number: 2, date: "2026-08-28" }),
      tx({ amount: 10_000, installment_number: 3, date: "2026-09-28" }),
    ];
    // Vencieron dos: la de julio y la de hoy.
    expect(movementsDelta(cuotas, A, HOY)).toBe(-20_000);
  });

  it("no cuenta movimientos de otra cuenta", () => {
    expect(movementsDelta([tx({ amount: 500, account_id: B })], A, HOY)).toBe(0);
  });
});
