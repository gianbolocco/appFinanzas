"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Pause,
  Play,
  CheckCircle2,
  AlertCircle,
  CalendarClock,
  Pencil,
  ChevronDown,
  ChevronUp,
  History,
} from "lucide-react";

import {
  createSubscription,
  updateSubscription,
  deleteSubscription,
  toggleSubscription,
  registerSubscriptionPayment,
} from "@/lib/actions";
import { formatMoney, formatDate } from "@/lib/format";
import { Modal } from "@/components/modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";

type Subscription = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  cadence: string;
  next_date: string;
  active: boolean;
  category_id: string | null;
  account_id: string | null;
  monthlyEquivalent: number;
  daysUntil: number;
  isDueSoon: boolean;
  isOverdue: boolean;
  category: { name: string } | null;
  account: { name: string } | null;
};
type Category = { id: string; name: string; kind: string };
type Account = { id: string; name: string; currency: string };
type Payment = {
  id: string;
  amount: number;
  currency: string;
  date: string;
  note: string | null;
  account: { name: string } | null;
};

const CADENCE_LABELS: Record<string, string> = {
  weekly: "Semanal",
  monthly: "Mensual",
  quarterly: "Trimestral",
  yearly: "Anual",
};

const CURRENCIES = ["ARS", "USD"];

export function SubscriptionList({
  subscriptions,
  categories,
  accounts,
  baseCurrency,
  paymentsBySubscription,
}: {
  subscriptions: Subscription[];
  categories: Category[];
  accounts: Account[];
  baseCurrency: string;
  paymentsBySubscription: Record<string, Payment[]>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmPayment, setConfirmPayment] = useState<string | null>(null);

  const active = subscriptions.filter((s) => s.active);
  const paused = subscriptions.filter((s) => !s.active);
  const expenseCategories = categories.filter((c) => c.kind === "expense");

  function openNew() {
    setEditing(null);
    setError(null);
    setShowForm(true);
  }

  function openEdit(sub: Subscription) {
    setEditing(sub);
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        if (editing) {
          await updateSubscription(editing.id, fd);
          toast.success("Suscripción actualizada");
        } else {
          await createSubscription(fd);
          toast.success("Suscripción creada");
        }
        closeForm();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al guardar";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  function handleToggle(id: string, currentActive: boolean) {
    startTransition(async () => {
      try {
        await toggleSubscription(id, currentActive);
        toast.success(currentActive ? "Suscripción pausada" : "Suscripción activada");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSubscription(id);
        toast.success("Suscripción eliminada");
        closeForm();
        setConfirmDelete(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al eliminar";
        setError(msg);
        toast.error(msg);
        setConfirmDelete(null);
      }
    });
  }

  function handlePayment(id: string) {
    startTransition(async () => {
      try {
        await registerSubscriptionPayment(id);
        toast.success("Pago registrado");
        setConfirmPayment(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al registrar pago";
        setError(msg);
        toast.error(msg);
        setConfirmPayment(null);
      }
    });
  }

  function renderSub(s: Subscription) {
    const isExpanded = expandedId === s.id;
    const payments = paymentsBySubscription[s.id] ?? [];

    return (
      <div
        key={s.id}
        className={`group rounded-2xl border border-border bg-card p-4 shadow-sm ${!s.active ? "opacity-60" : ""}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${s.isOverdue ? "bg-destructive/10 text-destructive" : s.isDueSoon ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary"}`}
          >
            {s.isOverdue ? (
              <AlertCircle className="h-4 w-4" />
            ) : s.isDueSoon ? (
              <CalendarClock className="h-4 w-4" />
            ) : (
              <span className="text-xs font-bold">↻</span>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{s.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatMoney(s.amount, s.currency)} · {CADENCE_LABELS[s.cadence] ?? s.cadence}
              {s.account && ` · ${s.account.name}`}
            </p>
          </div>
          <p className="font-mono text-sm font-semibold tabular-nums">
            {formatMoney(s.amount, s.currency)}
          </p>
          <button
            onClick={() => openEdit(s)}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="Editar"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => setExpandedId(isExpanded ? null : s.id)}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-accent"
            aria-label="Historial"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Próxima fecha + alerta */}
        {s.active && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Próximo pago: {formatDate(s.next_date)}</span>
            {s.isOverdue && (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
                Vencida
              </span>
            )}
            {s.isDueSoon && !s.isOverdue && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-500">
                En {s.daysUntil} {s.daysUntil === 1 ? "día" : "días"}
              </span>
            )}
          </div>
        )}

        {/* Acciones */}
        <div className="mt-3 flex flex-wrap gap-2">
          {s.active && (
            <button
              onClick={() => { if (!pending && s.account_id) handlePayment(s.id) }}
              title={!s.account_id ? "Asignale una cuenta primero" : undefined}
              className={`flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:opacity-90 ${(pending || !s.account_id) ? "opacity-50 pointer-events-none" : ""}`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Registrar pago
            </button>
          )}
          {s.active && !s.account_id && (
            <span className="self-center text-xs text-muted-foreground">
              Sin cuenta asignada
            </span>
          )}
          <button
            onClick={() => { if (!pending) handleToggle(s.id, s.active) }}
            className={`flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium transition hover:bg-accent ${pending ? "opacity-50 pointer-events-none" : ""}`}
          >
            {s.active ? (
              <><Pause className="h-3.5 w-3.5" /> Pausar</>
            ) : (
              <><Play className="h-3.5 w-3.5" /> Activar</>
            )}
          </button>
        </div>

        {/* Historial de pagos expandible */}
        {isExpanded && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <History className="h-3.5 w-3.5" /> Historial de pagos ({payments.length})
            </div>
            {payments.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin pagos registrados todavía.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                    <div className="flex-1">
                      <p className="text-xs font-medium">{formatDate(p.date)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.account?.name ?? "Sin cuenta"}
                      </p>
                    </div>
                    <p className="font-mono text-xs font-semibold tabular-nums">
                      {formatMoney(p.amount, p.currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {/* Activas */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Activas</h2>
        {active.length === 0 && !showForm && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              No tenés suscripciones cargadas. Agregá Netflix, gym, Spotify, etc.
            </p>
          </div>
        )}
        {active.map(renderSub)}
      </section>

      {/* Pausadas */}
      {paused.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Pausadas</h2>
          {paused.map(renderSub)}
        </section>
      )}

      {/* Botón nueva suscripción */}
      <button
        onClick={openNew}
        className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
      >
        <Plus className="h-5 w-5" />
        Nueva suscripción
      </button>

      {/* Modal crear/editar */}
      <Modal
        open={showForm}
        onOpenChange={(o) => { if (!o) closeForm() }}
        title={editing ? "Editar suscripción" : "Nueva suscripción"}
      >
        <SubscriptionForm
          key={editing?.id ?? "new"}
          editing={editing}
          categories={expenseCategories}
          accounts={accounts}
          baseCurrency={baseCurrency}
          pending={pending}
          error={error}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          onDelete={editing ? () => handleDelete(editing.id) : undefined}
        />
      </Modal>
    </div>
  );
}

function SubscriptionForm({
  editing,
  categories,
  accounts,
  baseCurrency,
  pending,
  error,
  onSubmit,
  onCancel,
  onDelete,
}: {
  editing: Subscription | null;
  categories: Category[];
  accounts: Account[];
  baseCurrency: string;
  pending: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Nombre</label>
        <input
          name="name"
          required
          defaultValue={editing?.name ?? ""}
          placeholder="Ej.: Netflix"
          className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-sm font-medium">Monto</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            inputMode="decimal"
            required
            defaultValue={editing?.amount ?? ""}
            placeholder="Ej.: 8999"
            className="h-11 rounded-xl border border-input bg-background px-3 font-mono text-sm tabular-nums outline-none focus:border-primary"
          />
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
                  defaultChecked={c === (editing?.currency ?? baseCurrency)}
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

      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-sm font-medium">Cadencia</label>
          <select
            name="cadence"
            defaultValue={editing?.cadence ?? "monthly"}
            className="h-11 rounded-xl border border-input bg-background px-2 text-sm outline-none focus:border-primary"
          >
            {Object.entries(CADENCE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-sm font-medium">Próxima fecha</label>
          <input
            name="next_date"
            type="date"
            required
            defaultValue={editing?.next_date ?? new Date().toISOString().slice(0, 10)}
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Categoría</label>
        <select
          name="category_id"
          defaultValue={editing?.category_id ?? ""}
          className="h-11 rounded-xl border border-input bg-background px-2 text-sm outline-none focus:border-primary"
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Cuenta (de dónde se imputa)</label>
        <select
          name="account_id"
          defaultValue={editing?.account_id ?? ""}
          className="h-11 rounded-xl border border-input bg-background px-2 text-sm outline-none focus:border-primary"
        >
          <option value="">Sin cuenta</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-destructive transition hover:bg-destructive/5 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="h-11 flex-1 rounded-xl border border-border bg-background text-sm font-medium transition hover:bg-accent"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="h-11 flex-1 rounded-xl bg-primary text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : editing ? "Guardar" : "Crear"}
        </button>
      </div>
    </form>
  );
}
