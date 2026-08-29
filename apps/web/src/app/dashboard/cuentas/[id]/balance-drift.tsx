"use client";

import { useTransition } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { recalcAccountBalance } from "@/lib/actions";
import { formatMoney } from "@/lib/format";

/**
 * Solo aparece cuando el saldo guardado no coincide con apertura + movimientos.
 * Si todo cierra no se muestra nada: el aviso tiene que significar algo.
 */
export function BalanceDrift({
  accountId,
  stored,
  computed,
  drift,
  currency,
}: {
  accountId: string;
  stored: number;
  computed: number;
  drift: number;
  currency: string;
}) {
  const [pending, startTransition] = useTransition();

  if (Math.abs(drift) < 0.01) return null;

  function handleRecalc() {
    startTransition(async () => {
      try {
        await recalcAccountBalance(accountId);
        toast.success("Saldo recalculado");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al recalcular");
      }
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">El saldo no coincide con tus movimientos</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Guardado <span className="font-mono tabular-nums">{formatMoney(stored, currency)}</span>{" "}
            · según tus movimientos{" "}
            <span className="font-mono tabular-nums">{formatMoney(computed, currency)}</span> ·
            difieren{" "}
            <span className="text-foreground font-mono font-semibold tabular-nums">
              {formatMoney(Math.abs(drift), currency)}
            </span>
          </p>
        </div>
      </div>
      <button
        onClick={handleRecalc}
        disabled={pending}
        className="border-border bg-background hover:bg-accent h-10 rounded-xl border text-sm font-medium transition disabled:opacity-50"
      >
        {pending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Recalcular saldo"}
      </button>
    </section>
  );
}
