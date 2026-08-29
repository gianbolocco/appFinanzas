import { createElement } from "react";
import { Pencil } from "lucide-react";

import { getCategoryIcon } from "@/lib/category-icons";
import { formatSigned, formatShortDate } from "@/lib/format";

export type TxRow = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  note: string | null;
  date: string;
  category: { name: string; color: string; icon: string | null } | null;
  account: { name: string } | null;
  to_account: { name: string } | null;
  installment_number: number | null;
  installments_total: number | null;
};

export const TYPE_LABELS: Record<string, string> = {
  expense: "Gasto",
  income: "Ingreso",
  transfer: "Transfer",
  subscription: "Suscripción",
};

/**
 * Fila de movimiento compartida por Movimientos y por el Home: era el mismo
 * markup duplicado, y la copia del Home no tenía forma de editar.
 */
export function TransactionRow({ tx, onEdit }: { tx: TxRow; onEdit?: () => void }) {
  const isIncome = tx.type === "income";
  const signed = isIncome ? tx.amount : -tx.amount;
  const isInstallment = tx.installment_number && tx.installments_total;
  const catColor = tx.category?.color ?? "oklch(0.556 0 0)";

  return (
    <div className="border-border bg-card group flex items-center gap-3 rounded-2xl border p-3.5 shadow-sm transition hover:shadow-md">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `color-mix(in oklch, ${catColor} 15%, transparent)` }}
      >
        {createElement(getCategoryIcon(tx.category?.icon ?? null), {
          className: "h-5 w-5",
          style: { color: catColor },
        })}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {tx.note ?? tx.category?.name ?? "Movimiento"}
          {isInstallment && (
            <span className="text-muted-foreground ml-1 text-xs">
              ({tx.installment_number}/{tx.installments_total})
            </span>
          )}
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {formatShortDate(tx.date)} · {tx.account?.name} · {TYPE_LABELS[tx.type] ?? tx.type}
          {tx.type === "transfer" && tx.to_account && ` → ${tx.to_account.name}`}
        </p>
      </div>
      <p
        className={`font-mono text-sm font-semibold tabular-nums ${isIncome ? "text-primary" : "text-foreground"}`}
      >
        {formatSigned(signed, tx.currency)}
      </p>
      {onEdit && (
        <button
          onClick={onEdit}
          className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg p-1.5 transition lg:opacity-0 lg:group-hover:opacity-100"
          aria-label="Editar"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
