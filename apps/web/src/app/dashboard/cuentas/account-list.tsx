"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Banknote,
  Landmark,
  CreditCard,
  Smartphone,
  PiggyBank,
} from "lucide-react";

import { createAccount, deleteAccount, setDefaultAccount } from "@/lib/actions";
import { formatMoney, formatMoneyRound } from "@/lib/format";
import { Modal } from "@/components/modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";

import Link from "next/link";
import { Star } from "lucide-react";

type Account = {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  balanceBase: number | null;
  is_default: boolean;
  stats: {
    income: number;
    expense: number;
    transferIn: number;
    transferOut: number;
  };
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
  patrimonio,
}: {
  accounts: Account[];
  baseCurrency: string;
  patrimonio: number;
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

  function handleSetDefault(id: string) {
    startTransition(async () => {
      try {
        await setDefaultAccount(id);
        toast.success("Cuenta predeterminada actualizada");
      } catch {
        toast.error("Error al actualizar la cuenta predeterminada");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Botón agregar cuenta */}
      <button
        onClick={() => setShowForm(true)}
        className="border-border bg-card/50 text-muted-foreground hover:border-primary hover:text-primary flex h-12 items-center justify-center gap-2 rounded-2xl border border-dashed text-sm font-medium transition"
      >
        <Plus className="h-5 w-5" />
        Agregar cuenta
      </button>

      {accounts.length === 0 && !showForm && (
        <div className="border-border bg-card rounded-2xl border p-8 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">
            No tenés cuentas todavía. Creá la primera.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {accounts.map((a) => {
          const Icon = TYPE_ICONS[a.type] ?? Banknote;
          const totalIn = a.stats.income + a.stats.transferIn;
          const totalOut = a.stats.expense + a.stats.transferOut;
          const net = totalIn - totalOut;
          const share =
            patrimonio > 0 && a.balanceBase !== null ? (a.balanceBase / patrimonio) * 100 : null;

          return (
            <div
              key={a.id}
              className="border-border/50 bg-card/60 hover:border-border group relative flex flex-col rounded-2xl border p-5 shadow-sm backdrop-blur-xl transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <Link
                href={`/dashboard/cuentas/${a.id}`}
                className="absolute inset-0 z-0 rounded-2xl"
                aria-label={`Ver cuenta ${a.name}`}
              />

              <div className="pointer-events-none relative z-10 mb-5 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground flex h-12 w-12 items-center justify-center rounded-2xl transition-colors">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold leading-tight">{a.name}</h3>
                    <p className="text-muted-foreground text-xs">
                      {TYPE_LABELS[a.type] ?? a.type} · {a.currency}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSetDefault(a.id);
                    }}
                    className={`pointer-events-auto -mr-1 -mt-1 rounded-xl p-2 transition ${
                      a.is_default
                        ? "text-yellow-500 hover:text-yellow-600"
                        : "text-muted-foreground/30 hover:text-yellow-500/80"
                    }`}
                    aria-label="Marcar como predeterminada"
                    title="Marcar como predeterminada"
                  >
                    <Star className="h-4 w-4" fill={a.is_default ? "currentColor" : "none"} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmDelete(a.id);
                    }}
                    className="text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive pointer-events-auto -mr-1 rounded-xl p-2 transition"
                    aria-label="Eliminar cuenta"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="pointer-events-none relative z-10 mb-4 flex flex-col gap-0.5">
                <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-widest">
                  Saldo neto
                </p>
                <p className="font-mono text-3xl font-bold tabular-nums tracking-tight">
                  {formatMoney(a.balance, a.currency)}
                </p>
                <p className="text-muted-foreground h-4 font-mono text-xs tabular-nums">
                  {a.currency !== baseCurrency && a.balanceBase !== null
                    ? `≈ ${formatMoneyRound(a.balanceBase, baseCurrency)}`
                    : share !== null
                      ? `${share.toFixed(0)}% de tu patrimonio`
                      : ""}
                </p>
              </div>

              {/* Una fila por dato: dos montos en la misma línea no entran y se
                  encimaban. El neto arriba, que es la pregunta real. */}
              <div className="bg-background/60 pointer-events-none relative z-10 flex flex-col gap-1.5 rounded-xl p-3 shadow-inner">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                    Este mes
                  </span>
                  <span
                    className={`truncate font-mono text-sm font-semibold tabular-nums ${net > 0 ? "text-primary" : net < 0 ? "text-destructive" : ""}`}
                  >
                    {net > 0 ? "+" : net < 0 ? "−" : ""}
                    {formatMoneyRound(Math.abs(net), a.currency)}
                  </span>
                </div>
                <div className="text-muted-foreground flex items-baseline justify-between gap-2 text-xs">
                  <span>Ingresos</span>
                  <span className="truncate font-mono tabular-nums">
                    {formatMoneyRound(totalIn, a.currency)}
                  </span>
                </div>
                <div className="text-muted-foreground flex items-baseline justify-between gap-2 text-xs">
                  <span>Egresos</span>
                  <span className="truncate font-mono tabular-nums">
                    {formatMoneyRound(totalOut, a.currency)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal crear cuenta */}
      <Modal
        open={showForm}
        onOpenChange={(o) => {
          if (!o) setShowForm(false);
        }}
        title="Nueva cuenta"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Nombre</label>
            <input
              name="name"
              required
              placeholder="Ej.: Cuenta del banco"
              className="border-input bg-background focus:border-primary h-11 rounded-xl border px-3 text-sm outline-none"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-sm font-medium">Tipo</label>
              <select
                name="type"
                defaultValue="cash"
                className="border-input bg-background focus:border-primary h-11 rounded-xl border px-2 text-sm outline-none"
              >
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex w-[104px] shrink-0 flex-col gap-1.5">
              <label className="text-sm font-medium">Moneda</label>
              <div className="bg-muted flex h-11 w-full rounded-xl p-1">
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
                    <div className="text-muted-foreground peer-checked:bg-primary peer-checked:text-primary-foreground hover:bg-muted/50 peer-checked:hover:bg-primary flex h-full w-full items-center justify-center rounded-lg text-xs font-semibold transition-all peer-checked:shadow-sm">
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
              className="border-input bg-background focus:border-primary h-11 rounded-xl border px-3 font-mono text-sm tabular-nums outline-none"
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="border-border bg-background hover:bg-accent h-11 flex-1 rounded-xl border text-sm font-medium transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="bg-primary text-primary-foreground h-11 flex-1 rounded-xl text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Crear"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => {
          if (!o) setConfirmDelete(null);
        }}
        title="¿Eliminar cuenta?"
        description="Se borrarán la cuenta y todos sus movimientos. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
      />
    </div>
  );
}
