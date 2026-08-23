"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";

import { createCategory, deleteCategory } from "@/lib/actions";

type Category = {
  id: string;
  name: string;
  kind: string;
  parent_id: string | null;
  icon: string | null;
  color: string;
  is_predefined: boolean;
};

const KIND_LABELS: Record<string, string> = {
  expense: "Gasto",
  income: "Ingreso",
  transfer: "Transfer",
};

const COLORS = [
  "oklch(0.62 0.15 162)",
  "oklch(0.75 0.15 80)",
  "oklch(0.65 0.15 240)",
  "oklch(0.6 0.2 300)",
  "oklch(0.62 0.22 15)",
  "oklch(0.7 0.15 60)",
  "oklch(0.556 0 0)",
];

export function CategoryList({ categories }: { categories: Category[] }) {
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const predefined = categories.filter((c) => c.is_predefined);
  const custom = categories.filter((c) => !c.is_predefined);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createCategory(fd);
        (e.target as HTMLFormElement).reset();
        setShowForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta categoría?")) return;
    startTransition(async () => {
      try {
        await deleteCategory(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Predefinidas */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Predefinidas</h2>
        <div className="flex flex-col gap-1.5">
          {predefined.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: `color-mix(in oklch, ${c.color} 15%, transparent)` }}
              >
                <span className="text-sm">★</span>
              </div>
              <span className="flex-1 text-sm font-medium">{c.name}</span>
              <span className="text-xs text-muted-foreground">{KIND_LABELS[c.kind]}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Custom */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Tus categorías</h2>
        {custom.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {custom.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm"
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: `color-mix(in oklch, ${c.color} 15%, transparent)` }}
                >
                  <span className="text-sm">●</span>
                </div>
                <span className="flex-1 text-sm font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">{KIND_LABELS[c.kind]}</span>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

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
                placeholder="Ej.: Mascota"
                className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Tipo</label>
              <select
                name="kind"
                defaultValue="expense"
                className="h-11 rounded-xl border border-input bg-background px-2 text-sm outline-none focus:border-primary"
              >
                {Object.entries(KIND_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <label key={c} className="cursor-pointer">
                    <input type="radio" name="color" value={c} className="peer sr-only" />
                    <span
                      className="block h-8 w-8 rounded-full ring-offset-2 transition peer-checked:ring-2 peer-checked:ring-primary"
                      style={{ backgroundColor: c }}
                    />
                  </label>
                ))}
              </div>
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
            Nueva categoría
          </button>
        )}
      </section>
    </div>
  );
}
