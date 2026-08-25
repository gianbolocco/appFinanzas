"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2, Banknote, Landmark, CreditCard, Smartphone, PiggyBank } from "lucide-react";

import { createAccount, deleteAccount } from "@/lib/actions";
import { formatMoney } from "@/lib/format";
import { Modal } from "@/components/modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";

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

const CURRENCIES = ["ARS", "USD"];

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
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createAccount(fd);
        toast.success("Cuenta creada");
        (e.target as HTMLFormElement).reset();
        setShowForm(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al crear";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteAccount(id);
        toast.success("Cuenta eliminada");
        setConfirmDelete(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al eliminar";
        setError(msg);
        toast.error(msg);
        setConfirmDelete(null);
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
              onClick={() => setConfirmDelete(a.id)}
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}

      {/* Botón agregar cuenta */}
      <button
        onClick={() => setShowForm(true)}
        className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
      >
        <Plus className="h-5 w-5" />
        Agregar cuenta
      </button>

      {/* Modal crear cuenta */}
      <Modal open={showForm} onOpenChange={(o) => { if (!o) setShowForm(false) }} title="Nueva cuenta">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
            <div className="flex w-[104px] shrink-0 flex-col gap-1.5">
              <label className="text-sm font-medium">Moneda</label>
              <div className="flex h-11 w-full rounded-xl bg-muted p-1">
                {CURRENCIES.map((c) => (
                  <label
                    key={c}
                    className="relative flex flex-1 cursor-pointer items-center justify-center"
                  >
                    <input
                      type="radio"
                      name="currency"
                      value={c}
                      defaultChecked={c === baseCurrency}
                      className="peer sr-only"
                    />
                    <div className="flex h-full w-full items-center justify-center rounded-lg text-xs font-semibold text-muted-foreground transition-all peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:shadow-sm hover:bg-muted/50 peer-checked:hover:bg-primary">
                      {c}
                    </div>
                  </label>
                ))}
              </div>
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
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => { if (!o) setConfirmDelete(null) }}
        title="¿Eliminar cuenta?"
        description="Se borrarán la cuenta y todos sus movimientos. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
      />
    </div>
  );
}
