"use client";

import { useState } from "react";
import { Pencil, ArrowDownLeft, ArrowUpRight, ArrowRightLeft } from "lucide-react";

import { formatSigned, formatShortDate } from "@/lib/format";
import { getCategoryIcon } from "@/lib/category-icons";
import { TransactionSheet } from "@/components/transaction-sheet";

type Tx = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  note: string | null;
  date: string;
  category_id: string | null;
  account_id: string;
  to_account_id: string | null;
  parent_transaction_id: string | null;
  category: { name: string; color: string; icon: string | null } | null;
  account: { name: string } | null;
  to_account: { name: string } | null;
  installment_number: number | null;
  installments_total: number | null;
};

const TYPE_LABELS: Record<string, string> = {
  expense: "Gasto",
  income: "Ingreso",
  transfer: "Transfer",
  subscription: "Suscripción",
};

export function AccountTransactionList({
  transactions,
  accountId,
  accountCurrency,
  accounts,
  categories,
  baseCurrency,
}: {
  transactions: Tx[];
  accountId: string;
  accountCurrency: string;
  accounts: { id: string; name: string; type: string; currency: string }[];
  categories: {
    id: string;
    name: string;
    kind: string;
    parent_id: string | null;
    icon: string | null;
    color: string;
    is_predefined: boolean;
  }[];
  baseCurrency: string;
}) {
  const [editingTx, setEditingTx] = useState<Tx | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function openEdit(tx: Tx) {
    setEditingTx(tx);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditingTx(null);
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">Sin movimientos en esta cuenta.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {transactions.map((t) => {
        const isIncoming = t.type === "income" || (t.type === "transfer" && t.to_account_id === accountId);
        const signed = isIncoming ? t.amount : -t.amount;
        const isInstallment = t.installment_number && t.installments_total;
        const Icon = getCategoryIcon(t.category?.icon ?? null);
        const catColor = t.category?.color ?? "oklch(0.556 0 0)";

        const TransferIcon = t.type === "transfer" ? ArrowRightLeft : isIncoming ? ArrowDownLeft : ArrowUpRight;

        return (
          <div
            key={t.id}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm transition hover:shadow-md"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `color-mix(in oklch, ${catColor} 15%, transparent)` }}
            >
              {t.type === "transfer" ? (
                <TransferIcon className="h-5 w-5" style={{ color: catColor }} />
              ) : (
                <Icon className="h-5 w-5" style={{ color: catColor }} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {t.note ?? t.category?.name ?? "Movimiento"}
                {isInstallment && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({t.installment_number}/{t.installments_total})
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {formatShortDate(t.date)} · {TYPE_LABELS[t.type]}
                {t.type === "transfer" && (
                  <span>
                    {" "}
                    {isIncoming ? "←" : "→"}{" "}
                    {isIncoming ? t.account?.name : t.to_account?.name}
                  </span>
                )}
              </p>
            </div>
            <p
              className={`font-mono text-sm font-semibold tabular-nums ${isIncoming ? "text-primary" : "text-foreground"}`}
            >
              {formatSigned(signed, t.currency)}
            </p>
            <button
              onClick={() => openEdit(t)}
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground lg:opacity-0 lg:group-hover:opacity-100"
              aria-label="Editar"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        );
      })}

      <TransactionSheet
        open={sheetOpen}
        onClose={closeSheet}
        accounts={accounts}
        categories={categories}
        baseCurrency={baseCurrency}
        editingTx={editingTx}
      />
    </div>
  );
}
