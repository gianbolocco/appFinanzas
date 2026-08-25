"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2, Archive, Target, ChevronDown, ChevronUp } from "lucide-react";

import { createGoal, deleteGoal, archiveGoal, contributeToGoal } from "@/lib/actions";
import { formatMoney, formatDate } from "@/lib/format";
import { Modal } from "@/components/modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";

type Goal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  currency: string;
  archived: boolean;
  progress: number;
  remaining: number;
  monthsLeft: number | null;
  suggestedMonthly: number | null;
  isCompleted: boolean;
};

export function GoalList({ goals, baseCurrency }: { goals: Goal[]; baseCurrency: string }) {
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const active = goals.filter((g) => !g.archived);
  const archived = goals.filter((g) => g.archived);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createGoal(fd);
        toast.success("Meta creada");
        setShowForm(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al crear";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  function handleContribute(goalId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await contributeToGoal(goalId, fd);
        toast.success("Aporte registrado");
        (e.target as HTMLFormElement).reset();
        setExpandedId(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al aportar";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteGoal(id);
        toast.success("Meta eliminada");
        setConfirmDelete(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al eliminar";
        setError(msg);
        toast.error(msg);
        setConfirmDelete(null);
      }
    });
  }

  function handleArchive(id: string) {
    startTransition(async () => {
      try {
        await archiveGoal(id);
        toast.success("Meta archivada");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al archivar";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  function renderGoal(g: Goal) {
    const isExpanded = expandedId === g.id;
    return (
      <div
        key={g.id}
        className="group rounded-2xl border border-border bg-card p-4 shadow-sm"
      >
        <button
          onClick={() => setExpandedId(isExpanded ? null : g.id)}
          className="flex w-full items-center gap-3 text-left"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Target className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{g.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatMoney(g.current_amount, g.currency)} / {formatMoney(g.target_amount, g.currency)}
            </p>
          </div>
          <span className="font-mono text-sm font-semibold tabular-nums">
            {g.progress.toFixed(0)}%
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Barra de progreso */}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${g.isCompleted ? "bg-primary" : "bg-primary"}`}
            style={{ width: `${Math.min(100, g.progress)}%` }}
          />
        </div>

        {/* Detalle expandible */}
        {isExpanded && (
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Restante</p>
                <p className="font-mono font-medium tabular-nums">
                  {formatMoney(g.remaining, g.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fecha objetivo</p>
                <p className="font-medium">{g.target_date ? formatDate(g.target_date) : "Sin fecha"}</p>
              </div>
              {g.suggestedMonthly && g.monthsLeft && (
                <div className="col-span-2 rounded-lg bg-primary/5 px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    Para llegar a tiempo ({g.monthsLeft} {g.monthsLeft === 1 ? "mes" : "meses"}):
                    ahorrá{" "}
                    <span className="font-mono font-semibold text-primary">
                      {formatMoney(g.suggestedMonthly, g.currency)}/mes
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Aporte rápido */}
            {!g.archived && !g.isCompleted && (
              <form
                onSubmit={(e) => handleContribute(g.id, e)}
                className="flex gap-2"
              >
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  required
                  placeholder="Monto del aporte"
                  className="h-10 flex-1 rounded-xl border border-input bg-background px-3 font-mono text-sm tabular-nums outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aportar"}
                </button>
              </form>
            )}

            {g.isCompleted && (
              <p className="rounded-lg bg-primary/10 px-3 py-2 text-center text-sm font-medium text-primary">
                ¡Meta completada! 🎉
              </p>
            )}

            {/* Acciones */}
            <div className="flex gap-2">
              {!g.archived && (
                <button
                  onClick={() => handleArchive(g.id)}
                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-xs font-medium transition hover:bg-accent"
                >
                  <Archive className="h-3.5 w-3.5" /> Archivar
                </button>
              )}
              <button
                onClick={() => setConfirmDelete(g.id)}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-xs font-medium text-destructive transition hover:bg-destructive/5"
              >
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </button>
            </div>
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

      {/* Metas activas */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Activas</h2>
        {active.length === 0 && !showForm && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              No tenés metas activas. Creá una para empezar a ahorrar.
            </p>
          </div>
        )}
        {active.map(renderGoal)}
      </section>

      {/* Metas archivadas */}
      {archived.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Archivadas</h2>
          {archived.map(renderGoal)}
        </section>
      )}

      {/* Botón nueva meta */}
      <button
        onClick={() => setShowForm(true)}
        className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
      >
        <Plus className="h-5 w-5" />
        Nueva meta
      </button>

      {/* Modal crear */}
      <Modal open={showForm} onOpenChange={(o) => { if (!o) setShowForm(false) }} title="Nueva meta">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Nombre</label>
            <input
              name="name"
              required
              placeholder="Ej.: Vacaciones"
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Monto objetivo</label>
            <input
              name="target_amount"
              type="number"
              step="0.01"
              inputMode="decimal"
              required
              placeholder="Ej.: 1000000"
              className="h-11 rounded-xl border border-input bg-background px-3 font-mono text-sm tabular-nums outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Fecha objetivo (opcional)</label>
            <input
              name="target_date"
              type="date"
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <input type="hidden" name="currency" value={baseCurrency} />
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
        title="¿Eliminar meta?"
        description="Se borrarán la meta y todos sus aportes. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
      />
    </div>
  );
}
