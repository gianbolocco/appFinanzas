"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createTransaction, updateTransaction, deleteTransaction } from "@/lib/actions";
import { Modal } from "@/components/modal";
import { ConfirmDialog } from "@/components/confirm-dialog";

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

const CURRENCIES = ["ARS", "USD"];

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
  const [currency, setCurrency] = useState(editingTx?.currency ?? baseCurrency);
  const [accountId, setAccountId] = useState(editingTx?.account_id ?? accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(editingTx?.to_account_id ?? "");
  const [categoryId, setCategoryId] = useState(editingTx?.category_id ?? "");
  const [note, setNote] = useState(editingTx?.note ?? "");
  const [date, setDate] = useState(editingTx?.date ?? new Date().toISOString().slice(0, 10));
  const [installments, setInstallments] = useState("");
  const [destRate, setDestRate] = useState("1");

  const fromAccount = accounts.find((a) => a.id === accountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);
  const isCrossCurrency =
    type === "transfer" && fromAccount && toAccount && fromAccount.currency !== toAccount.currency;
  const destAmount = isCrossCurrency && amount ? Number(amount) * Number(destRate || 0) : null;

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
        <div className="flex gap-1 rounded-xl bg-muted p-1">
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
          <label className="text-sm font-medium">Monto</label>
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
            className="h-12 w-full rounded-xl border border-input bg-card px-4 font-mono text-lg tabular-nums outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Moneda */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Moneda</label>
          <div className="flex h-12 w-full rounded-xl bg-muted p-1">
            {CURRENCIES.map((c) => (
              <label
                key={c}
                className="relative flex flex-1 cursor-pointer items-center justify-center"
              >
                <input
                  type="radio"
                  name="currency"
                  value={c}
                  checked={currency === c}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="peer sr-only"
                />
                <div className="flex h-full w-full items-center justify-center rounded-lg text-sm font-semibold text-muted-foreground transition-all peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:shadow-sm hover:bg-muted/50 peer-checked:hover:bg-primary">
                  {c}
                </div>
              </label>
            ))}
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

        {/* Rate para transferencias entre distinta moneda */}
        {isCrossCurrency && (
          <div className="flex flex-col gap-1.5 rounded-xl bg-muted/50 p-3">
            <label className="text-sm font-medium">
              Tipo de cambio: 1 {fromAccount?.currency} = ?
            </label>
            <div className="flex items-center gap-2">
              <input
                name="dest_rate"
                type="number"
                step="0.0001"
                inputMode="decimal"
                value={destRate}
                onChange={(e) => setDestRate(e.target.value)}
                placeholder="Ej.: 1200"
                required
                className="h-11 flex-1 rounded-xl border border-input bg-background px-3 font-mono text-sm tabular-nums outline-none focus:border-primary"
              />
              <span className="text-sm font-medium text-muted-foreground">{toAccount?.currency}</span>
            </div>
            {destAmount !== null && (
              <p className="text-xs text-muted-foreground">
                Recibe {destAmount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                {toAccount?.currency}
              </p>
            )}
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

        {isInstallmentChild && (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            Esta es una cuota de una compra en cuotas. Editá la transacción padre para modificarla.
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="mt-2 flex gap-2">
          {isEditing && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={pending}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-card text-destructive transition hover:bg-destructive/5 active:scale-[0.98] disabled:opacity-50"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
          <button
            type="submit"
            disabled={pending || accounts.length === 0}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditing ? "Guardar cambios" : "Guardar"}
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
