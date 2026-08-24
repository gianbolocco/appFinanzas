"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2, Pause, Play, CheckCircle2, AlertCircle, CalendarClock } from "lucide-react";

import { createSubscription, deleteSubscription, toggleSubscription, registerSubscriptionPayment } from "@/lib/actions";
import { formatMoney, formatDate } from "@/lib/format";

type Subscription = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  cadence: string;
  next_date: string;
  active: boolean;
  monthlyEquivalent: number;
  daysUntil: number;
  isDueSoon: boolean;
  isOverdue: boolean;
  category: { name: string } | null;
  account: { name: string } | null;
};
type Category = { id: string; name: string; kind: string };
type Account = { id: string; name: string; currency: string };

const CADENCE_LABELS: Record<string, string> = {
  weekly: "Semanal",
  monthly: "Mensual",
  quarterly: "Trimestral",
  yearly: "Anual",
};

const CURRENCIES = ["ARS", "USD", "EUR", "BRL", "MXN", "CLP", "COP", "PEN", "UYU"];

export function SubscriptionList({
  subscriptions,
  categories,
  accounts,
  baseCurrency,
}: {
  subscriptions: Subscription[];
  categories: Category[];
  accounts: Account[];
  baseCurrency: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const active = subscriptions.filter((s) => s.active);
  const paused = subscriptions.filter((s) => !s.active);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createSubscription(fd);
        setShowForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  function handleToggle(id: string, currentActive: boolean) {
    startTransition(async () => {
      try {
        await toggleSubscription(id, currentActive);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta suscripción?")) return;
    startTransition(async () => {
      try {
        await deleteSubscription(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  function handlePayment(id: string) {
    if (!confirm("¿Registrar el pago de esta suscripción? Se creará un gasto.")) return;
    startTransition(async () => {
      try {
        await registerSubscriptionPayment(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  function renderSub(s: Subscription) {
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
              onClick={() => handlePayment(s.id)}
              disabled={pending}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Registrar pago
            </button>
          )}
          <button
            onClick={() => handleToggle(s.id, s.active)}
            disabled={pending}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium transition hover:bg-accent"
          >
            {s.active ? (
              <><Pause className="h-3.5 w-3.5" /> Pausar</>
            ) : (
              <><Play className="h-3.5 w-3.5" /> Activar</>
            )}
          </button>
          <button
            onClick={() => handleDelete(s.id)}
            disabled={pending}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-destructive transition hover:bg-destructive/5 lg:opacity-0 lg:group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" /> Eliminar
          </button>
        </div>
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

      {/* Formulario crear */}
      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <h3 className="text-sm font-semibold">Nueva suscripción</h3>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Nombre</label>
            <input
              name="name"
              required
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
                placeholder="Ej.: 8999"
                className="h-11 rounded-xl border border-input bg-background px-3 font-mono text-sm tabular-nums outline-none focus:border-primary"
              />
            </div>
            <div className="flex w-28 flex-col gap-1.5">
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
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-sm font-medium">Cadencia</label>
              <select
                name="cadence"
                defaultValue="monthly"
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
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Categoría (opcional)</label>
            <select
              name="category_id"
              className="h-11 rounded-xl border border-input bg-background px-2 text-sm outline-none focus:border-primary"
            >
              <option value="">Sin categoría</option>
              {categories.filter((c) => c.kind === "expense").map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Cuenta (opcional)</label>
            <select
              name="account_id"
              className="h-11 rounded-xl border border-input bg-background px-2 text-sm outline-none focus:border-primary"
            >
              <option value="">Sin cuenta</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>
              ))}
            </select>
          </div>
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
          Nueva suscripción
        </button>
      )}
    </div>
  );
}
