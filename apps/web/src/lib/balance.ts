export type BalanceTx = {
  type: string;
  amount: number;
  dest_amount: number | null;
  date: string;
  account_id: string | null;
  to_account_id: string | null;
  installment_number: number | null;
  is_installment_parent: boolean;
};

/**
 * Efecto neto de los movimientos sobre el saldo de una cuenta.
 *
 * Replica las mismas reglas con las que la app escribe el saldo. Si esta función
 * y la escritura se separan, la reconciliación reporta deriva donde no la hay,
 * así que cualquier cambio en una tiene que ir a la otra:
 *   · income suma; expense y transfer restan sobre la cuenta origen.
 *   · el destino de una transferencia recibe dest_amount, que está en SU moneda.
 *   · el padre de una compra en cuotas no mueve saldo (lo mueven las cuotas).
 *   · una cuota mueve saldo recién cuando vence, no al comprar.
 */
export function movementsDelta(txs: BalanceTx[], accountId: string, todayIso: string): number {
  let delta = 0;
  for (const t of txs) {
    if (t.is_installment_parent) continue;
    if (t.installment_number !== null && t.date > todayIso) continue;

    if (t.account_id === accountId) delta += t.type === "income" ? t.amount : -t.amount;
    if (t.to_account_id === accountId && t.type === "transfer") delta += t.dest_amount ?? t.amount;
  }
  return delta;
}
