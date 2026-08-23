"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { TransactionSheet } from "@/components/transaction-sheet";

type Account = { id: string; name: string; type: string; currency: string };
type Category = {
  id: string;
  name: string;
  kind: string;
  parent_id: string | null;
  icon: string | null;
  color: string;
  is_predefined: boolean;
};

export function FAB({
  accounts,
  categories,
  baseCurrency,
}: {
  accounts: Account[];
  categories: Category[];
  baseCurrency: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="pointer-events-auto absolute -top-6 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 active:scale-95 lg:hidden"
        aria-label="Agregar movimiento"
      >
        <Plus className="h-6 w-6" />
      </button>
      <TransactionSheet
        open={open}
        onClose={() => setOpen(false)}
        accounts={accounts}
        categories={categories}
        baseCurrency={baseCurrency}
      />
    </>
  );
}
