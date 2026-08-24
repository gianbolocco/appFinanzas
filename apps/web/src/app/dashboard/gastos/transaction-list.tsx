"use client";

import { useState, useMemo } from "react";
import { Search, Filter, X, Pencil } from "lucide-react";

import { formatSigned, formatShortDate } from "@/lib/format";
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
type Account = { id: string; name: string; type: string; currency: string };

const TYPE_LABELS: Record<string, string> = {
  expense: "Gasto",
  income: "Ingreso",
  transfer: "Transfer",
  subscription: "Suscripción",
};

export function TransactionList({
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
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [catFilter, setCatFilter] = useState<string>("");
  const [accFilter, setAccFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [editingTx, setEditingTx] = useState<Tx | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (typeFilter && t.type !== typeFilter) return false;
      if (catFilter && t.category?.name !== catFilter) return false;
      if (accFilter && t.account?.name !== accFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${t.note ?? ""} ${t.category?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, typeFilter, catFilter, accFilter, search]);

  const hasFilters = typeFilter || catFilter || accFilter || search;

  function clearFilters() {
    setTypeFilter("");
    setCatFilter("");
    setAccFilter("");
    setSearch("");
  }

  function openEdit(tx: Tx) {
    setEditingTx(tx);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditingTx(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Barra de búsqueda + filtro */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={() => setShowFilters((s) => !s)}
          className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${showFilters || hasFilters ? "border-primary bg-primary/5 text-primary" : "border-border bg-card text-muted-foreground"}`}
        >
          <Filter className="h-4 w-4" />
        </button>
      </div>

      {/* Filtros expandibles */}
      {showFilters && (
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 flex-1 rounded-lg border border-input bg-background px-2 text-xs outline-none focus:border-primary"
            >
              <option value="">Todos los tipos</option>
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="h-9 flex-1 rounded-lg border border-input bg-background px-2 text-xs outline-none focus:border-primary"
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <select
              value={accFilter}
              onChange={(e) => setAccFilter(e.target.value)}
              className="h-9 flex-1 rounded-lg border border-input bg-background px-2 text-xs outline-none focus:border-primary"
            >
              <option value="">Todas las cuentas</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.name}>{a.name}</option>
              ))}
            </select>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex h-9 items-center gap-1 rounded-lg border border-border px-2 text-xs text-muted-foreground hover:bg-accent"
              >
                <X className="h-3 w-3" /> Limpiar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            {hasFilters ? "No hay movimientos con esos filtros." : "Todavía no cargaste movimientos."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((t) => {
            const isIncome = t.type === "income";
            const signed = isIncome ? t.amount : -t.amount;
            const isInstallment = t.installment_number && t.installments_total;
            return (
              <div
                key={t.id}
                className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm transition hover:shadow-md"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
                  style={{
                    backgroundColor: `color-mix(in oklch, ${t.category?.color ?? "oklch(0.556 0 0)"} 15%, transparent)`,
                  }}
                >
                  {t.category?.icon ?? "💰"}
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
                    {formatShortDate(t.date)} · {t.account?.name} · {TYPE_LABELS[t.type]}
                  </p>
                </div>
                <p
                  className={`font-mono text-sm font-semibold tabular-nums ${isIncome ? "text-primary" : "text-foreground"}`}
                >
                  {formatSigned(signed, t.currency)}
                </p>
                <button
                  onClick={() => openEdit(t)}
                  className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground group-hover:opacity-100"
                  aria-label="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

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
