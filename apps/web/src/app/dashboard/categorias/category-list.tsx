"use client";

import React, { useState, useTransition } from "react";
import { Plus, Trash2, Loader2, Pencil, Eye, EyeOff, type LucideIcon } from "lucide-react";

import { createCategory, updateCategory, deleteCategory, setCategoryHidden } from "@/lib/actions";
import { getCategoryIcon, ICON_NAMES } from "@/lib/category-icons";
import { Modal } from "@/components/modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";

type Category = {
  id: string;
  name: string;
  kind: string;
  parent_id: string | null;
  icon: string | null;
  color: string;
  is_predefined: boolean;
  hidden: boolean;
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
  "oklch(0.55 0.15 180)",
  "oklch(0.556 0 0)",
];

const ICON_LIST: { name: string; Icon: LucideIcon }[] = ICON_NAMES.map((name) => ({
  name,
  Icon: getCategoryIcon(name),
}));

export function CategoryList({ categories }: { categories: Category[] }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const predefined = categories.filter((c) => c.is_predefined && !c.hidden);
  const hiddenOnes = categories.filter((c) => c.is_predefined && c.hidden);
  const custom = categories.filter((c) => !c.is_predefined);

  function handleToggleHidden(cat: Category) {
    startTransition(async () => {
      try {
        await setCategoryHidden(cat.id, !cat.hidden);
        toast.success(cat.hidden ? `"${cat.name}" vuelve a aparecer` : `"${cat.name}" oculta`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al ocultar");
      }
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        if (editing) {
          await updateCategory(editing.id, fd);
          toast.success("Categoría actualizada");
        } else {
          await createCategory(fd);
          toast.success("Categoría creada");
        }
        setShowForm(false);
        setEditing(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al guardar";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteCategory(id);
        toast.success("Categoría eliminada");
        setShowForm(false);
        setEditing(null);
        setConfirmDelete(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al eliminar";
        setError(msg);
        toast.error(msg);
        setConfirmDelete(null);
      }
    });
  }

  function openNew() {
    setEditing(null);
    setError(null);
    setShowForm(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <button
        onClick={openNew}
        className="border-border bg-card/50 text-muted-foreground hover:border-primary hover:text-primary flex h-12 items-center justify-center gap-2 rounded-2xl border border-dashed text-sm font-medium transition"
      >
        <Plus className="h-5 w-5" />
        Nueva categoría
      </button>

      {/* Custom */}
      <section className="flex flex-col gap-2">
        <h2 className="text-muted-foreground text-sm font-semibold">Tus categorías</h2>
        {custom.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {custom.map((c) => {
              return (
                <div
                  key={c.id}
                  className="border-border bg-card group flex items-center gap-3 rounded-2xl border p-3.5 shadow-sm transition hover:shadow-md"
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full"
                    style={{ backgroundColor: `color-mix(in oklch, ${c.color} 15%, transparent)` }}
                  >
                    <CategoryIconRender
                      name={c.icon ?? "circle-ellipsis"}
                      className="h-4 w-4"
                      color={c.color}
                    />
                  </div>
                  <span className="flex-1 text-sm font-medium">{c.name}</span>
                  <span className="text-muted-foreground text-xs">{KIND_LABELS[c.kind]}</span>
                  <button
                    onClick={() => openEdit(c)}
                    className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg p-1.5 opacity-0 transition group-hover:opacity-100"
                    aria-label="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(c.id)}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg p-1.5 opacity-0 transition group-hover:opacity-100"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border-border bg-card/50 rounded-2xl border p-6 text-center shadow-sm">
            <p className="text-muted-foreground text-sm">
              No tenés categorías personalizadas. ¡Creá una para organizar mejor tus gastos!
            </p>
          </div>
        )}
      </section>

      {/* Predefinidas */}
      <section className="mt-2 flex flex-col gap-2">
        <h2 className="text-muted-foreground text-sm font-semibold">Predefinidas</h2>
        <div className="flex flex-col gap-1.5">
          {predefined.map((c) => {
            return (
              <div
                key={c.id}
                className="border-border bg-card group flex items-center gap-3 rounded-2xl border p-3.5 shadow-sm transition hover:shadow-md"
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: `color-mix(in oklch, ${c.color} 15%, transparent)` }}
                >
                  <CategoryIconRender
                    name={c.icon ?? "circle-ellipsis"}
                    className="h-4 w-4"
                    color={c.color}
                  />
                </div>
                <span className="flex-1 text-sm font-medium">{c.name}</span>
                <span className="text-muted-foreground text-xs">{KIND_LABELS[c.kind]}</span>
                <button
                  onClick={() => handleToggleHidden(c)}
                  disabled={pending}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg p-1.5 opacity-0 transition disabled:opacity-50 group-hover:opacity-100"
                  aria-label="Ocultar categoría"
                  title="Ocultar: deja de aparecer en los selectores"
                >
                  <EyeOff className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-muted-foreground text-xs">
          Las predefinidas las comparten todos los usuarios, así que no se pueden borrar ni editar.
          Ocultarlas las saca de los selectores sin tocar tus movimientos ya cargados.
        </p>
      </section>

      {/* Ocultas */}
      {hiddenOnes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-sm font-semibold">
            Ocultas ({hiddenOnes.length})
          </h2>
          <div className="flex flex-col gap-1.5">
            {hiddenOnes.map((c) => (
              <div
                key={c.id}
                className="border-border bg-card/40 group flex items-center gap-3 rounded-2xl border border-dashed p-3.5 transition hover:shadow-sm"
              >
                <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-full">
                  <CategoryIconRender
                    name={c.icon ?? "circle-ellipsis"}
                    className="h-4 w-4 opacity-40"
                    color={c.color}
                  />
                </div>
                <span className="text-muted-foreground flex-1 text-sm">{c.name}</span>
                <span className="text-muted-foreground text-xs">{KIND_LABELS[c.kind]}</span>
                <button
                  onClick={() => handleToggleHidden(c)}
                  disabled={pending}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg p-1.5 transition disabled:opacity-50"
                  aria-label="Volver a mostrar"
                  title="Volver a mostrar"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <Modal
        open={showForm}
        onOpenChange={(o) => {
          if (!o) closeForm();
        }}
        title={editing ? "Editar categoría" : "Nueva categoría"}
      >
        <CategoryForm
          key={editing?.id ?? "new"}
          editing={editing}
          pending={pending}
          error={error}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          onDelete={editing ? () => setConfirmDelete(editing.id) : undefined}
        />
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => {
          if (!o) setConfirmDelete(null);
        }}
        title="¿Eliminar categoría?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
      />
    </div>
  );
}

function CategoryForm({
  editing,
  pending,
  error,
  onSubmit,
  onCancel,
  onDelete,
}: {
  editing: Category | null;
  pending: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [selectedIcon, setSelectedIcon] = useState(editing?.icon ?? "utensils");

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {/* Preview */}
      <div className="bg-muted/50 flex items-center gap-3 rounded-xl p-3">
        <PreviewIcon iconName={selectedIcon} color={editing?.color ?? COLORS[0]} />
        <span className="text-sm font-medium">{editing?.name ?? "Vista previa"}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Nombre</label>
        <input
          name="name"
          required
          defaultValue={editing?.name ?? ""}
          placeholder="Ej.: Mascota"
          className="border-input bg-background focus:border-primary h-11 rounded-xl border px-3 text-sm outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Tipo</label>
        <select
          name="kind"
          defaultValue={editing?.kind ?? "expense"}
          disabled={!!editing}
          className="border-input bg-background focus:border-primary h-11 rounded-xl border px-2 text-sm outline-none disabled:opacity-50"
        >
          {Object.entries(KIND_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <input type="hidden" name="icon" value={selectedIcon} />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Ícono</label>
        <div className="border-border bg-background grid grid-cols-8 gap-1.5 rounded-xl border p-2">
          {ICON_LIST.map(({ name, Icon }) => (
            <button
              key={name}
              type="button"
              onClick={() => setSelectedIcon(name)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${selectedIcon === name ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Color</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <label key={c} className="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={c}
                defaultChecked={editing?.color === c || (!editing && c === COLORS[0])}
                className="peer sr-only"
              />
              <span
                className="ring-offset-background peer-checked:ring-primary block h-8 w-8 rounded-full ring-offset-2 transition peer-checked:ring-2"
                style={{ backgroundColor: c }}
              />
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex gap-2">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="border-border bg-background text-destructive hover:bg-destructive/5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="border-border bg-background hover:bg-accent h-11 flex-1 rounded-xl border text-sm font-medium transition"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground h-11 flex-1 rounded-xl text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
          ) : editing ? (
            "Guardar"
          ) : (
            "Crear"
          )}
        </button>
      </div>
    </form>
  );
}

function PreviewIcon({ iconName, color }: { iconName: string; color: string }) {
  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-full"
      style={{ backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)` }}
    >
      <CategoryIconRender name={iconName} className="h-5 w-5" color={color} />
    </div>
  );
}

function CategoryIconRender({
  name,
  className,
  color,
}: {
  name: string;
  className?: string;
  color: string;
}) {
  const Icon = getCategoryIcon(name) as React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
  }>;
  return React.createElement(Icon, { className, style: { color } });
}
