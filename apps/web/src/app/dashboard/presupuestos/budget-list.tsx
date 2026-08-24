"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";

import { createBudget, deleteBudget } from "@/lib/actions";
import { formatMoney } from "@/lib/format";
import { getCategoryIcon } from "@/lib/category-icons";

type Budget = {
  id: string;
  category_id: string;
  amount_limit: number;
  currency: string;
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

function getStatus(pct: number) {
  if (pct > 100) return { color: "bg-destructive", text: "text-destructive", label: "Excedido" };
  if (pct >= 80) return { color: "bg-amber-500", text: "text-amber-500", label: "Cerca del límite" };
  return { color: "bg-primary", text: "text-primary", label: "OK" };
}

export function BudgetList({
  budgets,
  categories,
  baseCurrency,
}: {
  budgets: Budget[];
  categories: Category[];
  baseCurrency: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
        setShowForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar este presupuesto?")) return;
    startTransition(async () => {
      try {
        await deleteBudget(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {budgets.length === 0 && !showForm && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            No tenés presupuestos. Creá el primero para seguir tus gastos por categoría.
          </p>
        </div>
      )}

      {/* Lista de presupuestos con barras */}
      <div className="flex flex-col gap-2">
        {budgets.map((b) => {
          const pct = b.amount_limit > 0 ? (b.spent / b.amount_limit) * 100 : 0;
          const status = getStatus(pct);
          const Icon = getCategoryIcon(b.category?.icon ?? null);
          const catColor = b.category?.color ?? "oklch(0.556 0 0)";
          return (
            <div
              key={b.id}
              className="group rounded-2xl border border-border bg-card p-4 shadow-sm"
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
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(b.spent, b.currency)} / {formatMoney(b.amount_limit, b.currency)}
                  </p>
                </div>
                <span className={`text-xs font-medium ${status.text}`}>{status.label}</span>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive lg:opacity-0 lg:group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {/* Barra de progreso */}
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${status.color}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              {pct > 100 && (
                <p className="mt-1.5 text-xs text-destructive">
                  Excedido por {formatMoney(b.spent - b.amount_limit, b.currency)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Formulario crear */}
      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <h3 className="text-sm font-semibold">Nuevo presupuesto</h3>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Categoría</label>
            <select
              name="category_id"
              required
              className="h-11 rounded-xl border border-input bg-background px-2 text-sm outline-none focus:border-primary"
            >
              <option value="">Elegí una categoría</option>
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
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
              className="h-11 rounded-xl border border-input bg-background px-3 font-mono text-sm tabular-nums outline-none focus:border-primary"
            />
          </div>
          <input type="hidden" name="currency" value={baseCurrency} />
          <input type="hidden" name="period" value="monthly" />
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
              disabled={pending || availableCategories.length === 0}
              className="h-11 flex-1 rounded-xl bg-primary text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Crear"}
            </button>
          </div>
          {availableCategories.length === 0 && (
            <p className="text-xs text-muted-foreground">Ya tenés presupuesto para todas las categorías.</p>
          )}
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
        >
          <Plus className="h-5 w-5" />
          Nuevo presupuesto
        </button>
      )}
    </div>
  );
}
