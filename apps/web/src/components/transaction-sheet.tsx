"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getUsdQuote,
} from "@/lib/actions";
import { formatMoney } from "@/lib/format";
import { destRateFromQuote } from "@/lib/money";
import { todayLocal } from "@/lib/dates";
import { Modal } from "@/components/modal";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Account = { id: string; name: string; type: string; currency: string; balance: number };
type Category = {
  id: string;
  name: string;
  kind: string;
  parent_id: string | null;
  icon: string | null;
  color: string;
  is_predefined: boolean;
};
type EditingTx = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  category_id: string | null;
  account_id: string;
  to_account_id: string | null;
  note: string | null;
  date: string;
  parent_transaction_id: string | null;
} | null;

const TYPE_TABS = [
  { value: "expense", label: "Gasto" },
  { value: "income", label: "Ingreso" },
  { value: "transfer", label: "Transferencia" },
] as const;

export function TransactionSheet({
  open,
  onOpenChange,
  accounts,
  categories,
  baseCurrency,
  editingTx,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  categories: Category[];
  baseCurrency: string;
  editingTx?: EditingTx;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editingTx ? "Editar movimiento" : "Nuevo movimiento"}
    >
      <TransactionSheetInner
        key={editingTx?.id ?? "new"}
        onOpenChange={onOpenChange}
        accounts={accounts}
        categories={categories}
        baseCurrency={baseCurrency}
        editingTx={editingTx ?? null}
      />
    </Modal>
  );
}

function TransactionSheetInner({
  onOpenChange,
  accounts,
  categories,
  baseCurrency,
  editingTx,
}: {
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  categories: Category[];
  baseCurrency: string;
  editingTx: EditingTx;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEditing = !!editingTx;
  const isInstallmentChild = !!editingTx?.parent_transaction_id;

  const [type, setType] = useState<(typeof TYPE_TABS)[number]["value"]>(
    (editingTx?.type as (typeof TYPE_TABS)[number]["value"]) ?? "expense",
  );
  const [amount, setAmount] = useState(editingTx ? String(editingTx.amount) : "");
  const [accountId, setAccountId] = useState(editingTx?.account_id ?? accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(editingTx?.to_account_id ?? "");
  const [categoryId, setCategoryId] = useState(editingTx?.category_id ?? "");
  const [note, setNote] = useState(editingTx?.note ?? "");
  const [date, setDate] = useState(editingTx?.date ?? todayLocal());
  const [installments, setInstallments] = useState("");
  const [quote, setQuote] = useState("");

  const fromAccount = accounts.find((a) => a.id === accountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);

  // El monto va siempre en la moneda de la cuenta: es esa la plata que se mueve.
  // Elegirla aparte permitía cargar 20 USD contra una cuenta en pesos y descontar
  // 20 pesos del saldo.
  const currency = fromAccount?.currency ?? baseCurrency;

  const isCrossCurrency = Boolean(
    type === "transfer" && fromAccount && toAccount && fromAccount.currency !== toAccount.currency,
  );

  // La referencia se pide siempre en dólares: uno sabe que el dólar está a 1450,
  // no que el peso está a 0,00069.
  const refCurrency = !isCrossCurrency
    ? null
    : fromAccount!.currency === "USD" || toAccount!.currency === "USD"
      ? "USD"
      : fromAccount!.currency;
  const quoteCurrency = !isCrossCurrency
    ? null
    : refCurrency === fromAccount!.currency
      ? toAccount!.currency
      : fromAccount!.currency;

  // dest_rate = unidades de la moneda destino por cada unidad de la origen.
  const destRate = isCrossCurrency
    ? destRateFromQuote(fromAccount!.currency, refCurrency!, Number(quote))
    : 1;
  const destAmount = isCrossCurrency && amount ? Number(amount) * destRate : null;

  // Prellenar con la última cotización conocida; sigue siendo editable.
  useEffect(() => {
    if (refCurrency !== "USD" || !quoteCurrency) return;
    let alive = true;
    getUsdQuote(quoteCurrency).then((rate) => {
      if (alive && rate) setQuote(String(rate));
    });
    return () => {
      alive = false;
    };
  }, [refCurrency, quoteCurrency]);

  const filteredCategories = categories.filter((c) =>
    type === "transfer" ? c.kind === "transfer" : c.kind === type,
  );

  function close() {
    onOpenChange(false);
  }

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
        if (isEditing && editingTx) {
          await updateTransaction(editingTx.id, fd);
          toast.success("Movimiento actualizado");
        } else {
          await createTransaction(fd);
          toast.success("Movimiento creado");
        }
        router.refresh();
        close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al guardar";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  function handleDelete() {
    if (!editingTx) return;
    startTransition(async () => {
      try {
        await deleteTransaction(editingTx.id);
        toast.success("Movimiento eliminado");
        router.refresh();
        setConfirmDelete(false);
        close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al eliminar";
        setError(msg);
        toast.error(msg);
        setConfirmDelete(false);
      }
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input type="hidden" name="type" value={type} />

        {/* Tipo */}
        <div className="bg-muted flex gap-1 rounded-xl p-1">
          {TYPE_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${type === t.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Monto */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <label className="text-sm font-medium">Monto</label>
            {fromAccount && (
              <span className="text-muted-foreground text-xs">
                Disponible{" "}
                <span className="font-mono tabular-nums">
                  {formatMoney(fromAccount.balance, fromAccount.currency)}
                </span>
              </span>
            )}
          </div>
          <div className="relative">
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
              className="border-input bg-card focus:border-primary focus:ring-primary/20 h-12 w-full rounded-xl border pl-4 pr-28 font-mono text-lg tabular-nums outline-none transition focus:ring-2"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              <span className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs font-semibold">
                {currency}
              </span>
              {type === "transfer" && fromAccount && fromAccount.balance > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(fromAccount.balance))}
                  className="bg-primary/10 text-primary hover:bg-primary/20 rounded-md px-2 py-1 text-xs font-semibold transition"
                >
                  MAX
                </button>
              )}
            </div>
          </div>
          <input type="hidden" name="currency" value={currency} />
        </div>

        {/* Cuenta origen */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Cuenta</label>
          <select
            name="account_id"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="border-input bg-card focus:border-primary h-12 rounded-xl border px-3 text-sm outline-none"
          >
            {accounts.length === 0 && <option value="">Sin cuentas</option>}
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.currency}
              </option>
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
              className="border-input bg-card focus:border-primary h-12 rounded-xl border px-3 text-sm outline-none"
            >
              <option value="">Elegí destino</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Conversión entre monedas distintas */}
        {isCrossCurrency && (
          <div className="bg-muted/50 flex flex-col gap-2 rounded-xl p-3">
            <label className="text-sm font-medium">Cotización: 1 {refCurrency} =</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.0001"
                min="0"
                inputMode="decimal"
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="Ej.: 1450"
                required
                className="border-input bg-background focus:border-primary h-11 flex-1 rounded-xl border px-3 font-mono text-sm tabular-nums outline-none"
              />
              <span className="text-muted-foreground text-sm font-medium">{quoteCurrency}</span>
            </div>
            {destAmount !== null && destAmount > 0 && toAccount && (
              <p className="text-sm">
                Recibís{" "}
                <span className="font-mono font-semibold tabular-nums">
                  {formatMoney(destAmount, toAccount.currency)}
                </span>
              </p>
            )}
            <input type="hidden" name="dest_rate" value={destRate || ""} />
          </div>
        )}
        {type === "transfer" && !isCrossCurrency && (
          <input type="hidden" name="dest_rate" value="1" />
        )}

        {/* Categoría (no transferencias) */}
        {type !== "transfer" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Categoría</label>
            <select
              name="category_id"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="border-input bg-card focus:border-primary h-12 rounded-xl border px-3 text-sm outline-none"
            >
              <option value="">Sin categoría</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.is_predefined ? "★ " : ""}
                  {c.name}
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
            className="border-input bg-card focus:border-primary h-12 rounded-xl border px-3 text-sm outline-none"
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
            className="border-input bg-card focus:border-primary h-12 rounded-xl border px-3 text-sm outline-none"
          />
        </div>

        {/* Cuotas (solo gastos nuevos — no en edición) */}
        {type === "expense" && !isEditing && (
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
              className="border-input bg-card focus:border-primary h-12 rounded-xl border px-3 text-sm outline-none"
            />
            {installments && Number(installments) > 1 && amount && (
              <p className="text-muted-foreground text-xs">
                {Number(installments)} cuotas de ${" "}
                {(Number(amount) / Number(installments)).toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                })}{" "}
                {currency}
              </p>
            )}
          </div>
        )}

        {isInstallmentChild && (
          <p className="bg-muted text-muted-foreground rounded-lg px-3 py-2 text-xs">
            Esta es una cuota de una compra en cuotas. Editá la transacción padre para modificarla.
          </p>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="mt-2 flex gap-2">
          {isEditing && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={pending}
              className="border-border bg-card text-destructive hover:bg-destructive/5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition active:scale-[0.98] disabled:opacity-50"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
          <button
            type="submit"
            disabled={pending || accounts.length === 0}
            className="bg-primary text-primary-foreground flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEditing ? (
              "Guardar cambios"
            ) : (
              "Guardar"
            )}
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Eliminar movimiento?"
        description="Esta acción no se puede deshacer. Se borrarán la transacción y, si es una compra en cuotas, todas las cuotas asociadas."
        confirmLabel="Eliminar"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
