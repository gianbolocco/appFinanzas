"use client";

import { useTransition } from "react";
import { registerSubscriptionPayment } from "@/lib/actions";
import { formatMoney, formatDate } from "@/lib/format";
import { CheckCircle2, AlertCircle, CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Subscription = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  daysUntil: number;
  isOverdue: boolean;
  next_date: string;
};

export function DueSubscriptions({ subscriptions }: { subscriptions: Subscription[] }) {
  const [pending, startTransition] = useTransition();

  function handlePayment(id: string) {
    startTransition(async () => {
      try {
        await registerSubscriptionPayment(id);
        toast.success("Pago registrado");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al registrar pago");
      }
    });
  }

  if (subscriptions.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Próximos vencimientos</h2>
      <div className="flex flex-col gap-3">
        {subscriptions.map((s) => (
          <div
            key={s.id}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className="text-xs font-medium text-muted-foreground">
                    {s.isOverdue ? (
                      <span className="text-destructive font-semibold">Vencida</span>
                    ) : (
                      `Vence en ${s.daysUntil} ${s.daysUntil === 1 ? "día" : "días"}`
                    )}
                    <span className="font-normal"> · {formatDate(s.next_date)}</span>
                  </p>
                </div>
              </div>
              <p className="font-mono text-base font-bold tabular-nums">
                {formatMoney(s.amount, s.currency)}
              </p>
            </div>
            <button
              onClick={() => { if (!pending) handlePayment(s.id) }}
              className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-medium transition hover:bg-muted ${pending ? "opacity-50 pointer-events-none" : ""}`}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
              {pending ? "Registrando..." : "Registrar pago"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
