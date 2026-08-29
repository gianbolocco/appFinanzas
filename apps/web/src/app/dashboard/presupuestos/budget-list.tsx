"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2, Wand2 } from "lucide-react";

import { createBudget, createBudgetsBulk, deleteBudget } from "@/lib/actions";
import { formatMoney, formatMoneyRound } from "@/lib/format";
import { getCategoryIcon } from "@/lib/category-icons";
import { Modal } from "@/components/modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";

type Budget = {
  id: string;
  category_id: string;
  amount_limit: number;
  currency: string;
  /** Límite en moneda base. `spent` ya viene en base: comparar contra amount_limit mezclaba monedas. */
  limitBase: number | null;
  spent: number;
  category: { name: string; color: string; icon: string | null } | null;
};
type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: string;
  is_predefined: boolean;
};
type Suggestion = {
  category_id: string;
  name: string;
  color: string;
  spent: number;
  suggested: number;
};

function getStatus(pct: number) {
  if (pct > 100) return { color: "bg-destructive", text: "text-destructive", label: "Excedido" };
  if (pct >= 80)
    return { color: "bg-amber-500", text: "text-amber-500", label: "Cerca del límite" };
  return { color: "bg-primary", text: "text-primary", label: "OK" };
}

export function BudgetList({
  budgets,
  categories,
  baseCurrency,
  suggestions,
  suggestionsFromPreviousMonth,
}: {
  budgets: Budget[];
  categories: Category[];
  baseCurrency: string;
  suggestions: Suggestion[];
  suggestionsFromPreviousMonth: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const [picked, setPicked] = useState<Record<string, string>>({});

  function openSuggest() {
    // Todas marcadas por defecto: el caso normal es aceptarlas y ajustar una o dos.
    setPicked(Object.fromEntries(suggestions.map((s) => [s.category_id, String(s.suggested)])));
    setShowSuggest(true);
  }

  function handleCreateSuggested() {
    const items = Object.entries(picked)
      .map(([category_id, amount]) => ({ category_id, amount_limit: Number(amount) || 0 }))
      .filter((i) => i.amount_limit > 0);
    startTransition(async () => {
      try {
        const created = await createBudgetsBulk(items);
        toast.success(created === 1 ? "1 presupuesto creado" : `${created} presupuestos creados`);
        setShowSuggest(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al crear");
      }
    });
  }

  const availableCategories = categories.filter(
    (c) => !budgets.some((b) => b.category_id === c.id),
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createBudget(fd);
        toast.success("Presupuesto creado");
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
        await deleteBudget(id);
        toast.success("Presupuesto eliminado");
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
      {budgets.length === 0 && !showForm && (
        <div className="border-border bg-card rounded-2xl border p-8 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">
            No tenés presupuestos. Creá el primero para seguir tus gastos por categoría.
          </p>
        </div>
      )}

      {/* Lista de presupuestos con barras */}
      <div className="flex flex-col gap-2">
        {budgets.map((b) => {
          const limit = b.limitBase;
          const pct = limit && limit > 0 ? (b.spent / limit) * 100 : 0;
          const status = getStatus(pct);
          const Icon = getCategoryIcon(b.category?.icon ?? null);
          const catColor = b.category?.color ?? "oklch(0.556 0 0)";
          return (
            <div
              key={b.id}
              className="border-border bg-card group rounded-2xl border p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `color-mix(in oklch, ${catColor} 15%, transparent)` }}
                >
                  <Icon className="h-4 w-4" style={{ color: catColor }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{b.category?.name ?? "Sin categoría"}</p>
                  <p className="text-muted-foreground text-xs">
                    {limit === null ? (
                      <span className="text-amber-500">
                        Falta la cotización de {b.currency}: no se puede comparar
                      </span>
                    ) : (
                      `${formatMoneyRound(b.spent, baseCurrency)} / ${formatMoneyRound(limit, baseCurrency)}`
                    )}
                  </p>
                </div>
                <span className={`text-xs font-medium ${status.text}`}>{status.label}</span>
                <button
                  onClick={() => setConfirmDelete(b.id)}
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg p-1.5 transition lg:opacity-0 lg:group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {/* Barra de progreso */}
              <div className="bg-muted mt-3 h-2 overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full transition-all ${status.color}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              {limit !== null && pct > 100 && (
                <p className="text-destructive mt-1.5 text-xs">
                  Excedido por {formatMoney(b.spent - limit, baseCurrency)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Alta: manual o sugerida desde lo que ya gastaste */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => setShowForm(true)}
          className="border-border bg-card/50 text-muted-foreground hover:border-primary hover:text-primary flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-dashed text-sm font-medium transition"
        >
          <Plus className="h-5 w-5" />
          Nuevo presupuesto
        </button>
        {suggestions.length > 0 && (
          <button
            onClick={openSuggest}
            className="bg-primary/10 text-primary hover:bg-primary/20 flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-medium transition"
          >
            <Wand2 className="h-5 w-5" />
            Crear desde mis gastos
          </button>
        )}
      </div>

      {/* Modal sugerencias */}
      <Modal
        open={showSuggest}
        onOpenChange={(o) => {
          if (!o) setShowSuggest(false);
        }}
        title="Presupuestos sugeridos"
      >
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            Según{" "}
            {suggestionsFromPreviousMonth
              ? "lo que gastaste el mes pasado"
              : "lo que llevás gastado este mes"}
            , redondeado hacia arriba. Destildá lo que no quieras y ajustá los montos.
          </p>

          <div className="flex flex-col gap-1.5">
            {suggestions.map((sug) => {
              const checked = sug.category_id in picked;
              return (
                <div
                  key={sug.category_id}
                  className="border-border flex items-center gap-3 rounded-xl border p-2.5"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setPicked((prev) => {
                        const next = { ...prev };
                        if (e.target.checked) next[sug.category_id] = String(sug.suggested);
                        else delete next[sug.category_id];
                        return next;
                      })
                    }
                    className="accent-primary h-4 w-4 shrink-0"
                    aria-label={`Incluir ${sug.name}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{sug.name}</p>
                    <p className="text-muted-foreground text-xs">
                      Gastaste {formatMoneyRound(sug.spent, baseCurrency)}
                    </p>
                  </div>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    inputMode="decimal"
                    value={picked[sug.category_id] ?? ""}
                    disabled={!checked}
                    onChange={(e) =>
                      setPicked((prev) => ({ ...prev, [sug.category_id]: e.target.value }))
                    }
                    className="border-input bg-background focus:border-primary h-10 w-28 shrink-0 rounded-xl border px-2 text-right font-mono text-sm tabular-nums outline-none disabled:opacity-40"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowSuggest(false)}
              className="border-border bg-background hover:bg-accent h-11 flex-1 rounded-xl border text-sm font-medium transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateSuggested}
              disabled={pending || Object.keys(picked).length === 0}
              className="bg-primary text-primary-foreground h-11 flex-1 rounded-xl text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : (
                `Crear ${Object.keys(picked).length}`
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal crear */}
      <Modal
        open={showForm}
        onOpenChange={(o) => {
          if (!o) setShowForm(false);
        }}
        title="Nuevo presupuesto"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Categoría</label>
            <select
              name="category_id"
              required
              className="border-input bg-background focus:border-primary h-11 rounded-xl border px-2 text-sm outline-none"
            >
              <option value="">Elegí una categoría</option>
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Límite mensual</label>
            <input
              name="amount_limit"
              type="number"
              step="0.01"
              inputMode="decimal"
              required
              placeholder="Ej.: 50000"
              className="border-input bg-background focus:border-primary h-11 rounded-xl border px-3 font-mono text-sm tabular-nums outline-none"
            />
          </div>
          <input type="hidden" name="currency" value={baseCurrency} />
          <input type="hidden" name="period" value="monthly" />
          {error && <p className="text-destructive text-sm">{error}</p>}
          {availableCategories.length === 0 && (
            <p className="text-muted-foreground text-xs">
              Ya tenés presupuesto para todas las categorías.
            </p>
          )}
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
              disabled={pending || availableCategories.length === 0}
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
        title="¿Eliminar presupuesto?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
      />
    </div>
  );
}
