"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2, Banknote, Landmark, CreditCard, Smartphone, PiggyBank } from "lucide-react";

import { createAccount, deleteAccount } from "@/lib/actions";
import { formatMoney } from "@/lib/format";

type Account = {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
};

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  cash: Banknote,
  bank: Landmark,
  credit_card: CreditCard,
  debit_card: CreditCard,
  wallet: Smartphone,
  savings: PiggyBank,
};

const TYPE_LABELS: Record<string, string> = {
  cash: "Efectivo",
  bank: "Banco",
  credit_card: "Tarjeta de crédito",
  debit_card: "Tarjeta de débito",
  wallet: "Billetera",
  savings: "Ahorro",
};

const CURRENCIES = ["ARS", "USD", "EUR", "BRL", "MXN", "CLP", "COP", "PEN", "UYU"];

export function AccountList({
  accounts,
  baseCurrency,
}: {
  accounts: Account[];
  baseCurrency: string;
  typeLabels: Record<string, string>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createAccount(fd);
        (e.target as HTMLFormElement).reset();
        setShowForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta cuenta? Se borrarán sus movimientos.")) return;
    startTransition(async () => {
      try {
        await deleteAccount(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {accounts.length === 0 && !showForm && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">No tenés cuentas todavía. Creá la primera.</p>
        </div>
      )}

      {accounts.map((a) => {
        const Icon = TYPE_ICONS[a.type] ?? Banknote;
        return (
          <div
            key={a.id}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.name}</p>
              <p className="text-xs text-muted-foreground">
                {TYPE_LABELS[a.type] ?? a.type} · {a.currency}
              </p>
            </div>
            <p className="font-mono text-sm font-semibold tabular-nums">
              {formatMoney(a.balance, a.currency)}
            </p>
            <button
              onClick={() => handleDelete(a.id)}
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}

      {/* Formulario para crear cuenta */}
      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Nombre</label>
            <input
              name="name"
              required
              placeholder="Ej.: Cuenta del banco"
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-sm font-medium">Tipo</label>
              <select
                name="type"
                defaultValue="cash"
                className="h-11 rounded-xl border border-input bg-background px-2 text-sm outline-none focus:border-primary"
              >
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex w-24 flex-col gap-1.5">
              <label className="text-sm font-medium">Moneda</label>
              <select
                name="currency"
                defaultValue={baseCurrency}
                className="h-11 rounded-xl border border-input bg-background px-2 text-sm outline-none focus:border-primary"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Saldo inicial</label>
            <input
              name="balance"
              type="number"
              step="0.01"
              inputMode="decimal"
              defaultValue="0"
              className="h-11 rounded-xl border border-input bg-background px-3 font-mono text-sm tabular-nums outline-none focus:border-primary"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="h-11 flex-1 rounded-xl border border-border bg-background text-sm font-medium transition hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-11 flex-1 rounded-xl bg-primary text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Crear"}
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
        >
          <Plus className="h-5 w-5" />
          Agregar cuenta
        </button>
      )}
    </div>
  );
}
