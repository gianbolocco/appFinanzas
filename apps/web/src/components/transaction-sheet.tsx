"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";

import { createTransaction } from "@/lib/actions";

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

const TYPE_TABS = [
  { value: "expense", label: "Gasto" },
  { value: "income", label: "Ingreso" },
  { value: "transfer", label: "Transfer" },
] as const;

const CURRENCIES = ["ARS", "USD", "EUR", "BRL", "MXN", "CLP", "COP", "PEN", "UYU"];

export function TransactionSheet({
  open,
  onClose,
  accounts,
  categories,
  baseCurrency,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  baseCurrency: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<(typeof TYPE_TABS)[number]["value"]>("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(baseCurrency);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [installments, setInstallments] = useState("");

  if (!open) return null;

  const filteredCategories = categories.filter(
    (c) =>
      type === "transfer"
        ? c.kind === "transfer"
        : c.kind === type,
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (!fd.get("account_id")) {
      setError("Elegí una cuenta");
      return;
    }
    if (type === "transfer" && !fd.get("to_account_id")) {
      setError("Elegí la cuenta destino");
      return;
    }
    startTransition(async () => {
      try {
        await createTransaction(fd);
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 lg:items-center">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-background shadow-xl lg:rounded-3xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Nuevo movimiento</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <input type="hidden" name="type" value={type} />

          {/* Tipo */}
          <div className="flex gap-1 rounded-xl bg-muted p-1">
            {TYPE_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${type === t.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Monto */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Monto</label>
            <div className="flex gap-2">
              <input
                name="amount"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                required
                autoFocus
                className="h-12 flex-1 rounded-xl border border-input bg-card px-4 font-mono text-lg tabular-nums outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <select
                name="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-12 w-24 rounded-xl border border-input bg-card px-2 text-sm outline-none focus:border-primary"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cuenta origen */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Cuenta</label>
            <select
              name="account_id"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-12 rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary"
            >
              {accounts.length === 0 && <option value="">Sin cuentas</option>}
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>
              ))}
            </select>
          </div>

          {/* Cuenta destino (solo transferencias) */}
          {type === "transfer" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Cuenta destino</label>
              <select
                name="to_account_id"
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="h-12 rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary"
              >
                <option value="">Elegí destino</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>
                ))}
              </select>
            </div>
          )}

          {/* Categoría (no transferencias) */}
          {type !== "transfer" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Categoría</label>
              <select
                name="category_id"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-12 rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary"
              >
                <option value="">Sin categoría</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.is_predefined ? "★ " : ""}{c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Fecha */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Fecha</label>
            <input
              name="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-12 rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          {/* Nota */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Nota (opcional)</label>
            <input
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej.: super del mes"
              maxLength={200}
              className="h-12 rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          {/* Cuotas (solo gastos) */}
          {type === "expense" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Cuotas (opcional)</label>
              <input
                name="installments_total"
                type="number"
                min="1"
                max="60"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                placeholder="1 (pago único)"
                className="h-12 rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary"
              />
              {installments && Number(installments) > 1 && amount && (
                <p className="text-xs text-muted-foreground">
                  {Number(installments)} cuotas de ${" "}
                  {(Number(amount) / Number(installments)).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  {" "}{currency}
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={pending || accounts.length === 0}
            className="mt-2 flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </button>
        </form>
      </div>
    </div>
  );
}
