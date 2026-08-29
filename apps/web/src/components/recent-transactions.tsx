"use client";

import Link from "next/link";
import { useState } from "react";

import { TransactionRow } from "@/components/transaction-row";
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
type Category = {
  id: string;
  name: string;
  kind: string;
  parent_id: string | null;
  icon: string | null;
  color: string;
  is_predefined: boolean;
};
type Account = { id: string; name: string; type: string; currency: string; balance: number };

/** Los últimos movimientos del Home, editables igual que en Movimientos. */
export function RecentTransactions({
  transactions,
  categories,
  accounts,
  baseCurrency,
}: {
  transactions: Tx[];
  categories: Category[];
  accounts: Account[];
  baseCurrency: string;
}) {
  const [editingTx, setEditingTx] = useState<Tx | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Últimos movimientos</h2>
        <Link href="/dashboard/gastos" className="text-primary text-sm font-medium">
          Ver todo
        </Link>
      </div>

      {transactions.length === 0 ? (
        <div className="border-border bg-card rounded-2xl border p-6 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">
            Todavía no cargaste movimientos. Tocá el botón verde para sumar el primero.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {transactions.map((t) => (
            <TransactionRow
              key={t.id}
              tx={t}
              onEdit={() => {
                setEditingTx(t);
                setSheetOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <TransactionSheet
        open={sheetOpen}
        onOpenChange={(o) => {
          if (!o) {
            setSheetOpen(false);
            setEditingTx(null);
          }
        }}
        accounts={accounts}
        categories={categories}
        baseCurrency={baseCurrency}
        editingTx={editingTx}
      />
    </section>
  );
}
