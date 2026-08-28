"use client";

import { useTransition } from "react";
import { registerSubscriptionPayment } from "@/lib/actions";
import { formatMoney, formatDate } from "@/lib/format";
import { CheckCircle2, CalendarClock, Loader2 } from "lucide-react";
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
    <div className="flex flex-col gap-3">
      {subscriptions.map((s) => (
        <div
          key={s.id}
          className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{s.name}</p>
                <p className="text-muted-foreground text-xs font-medium">
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
            onClick={() => {
              if (!pending) handlePayment(s.id);
            }}
            className={`border-border bg-background hover:bg-muted flex h-10 w-full items-center justify-center gap-2 rounded-xl border text-sm font-medium transition ${pending ? "pointer-events-none opacity-50" : ""}`}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="text-muted-foreground h-4 w-4" />
            )}
            {pending ? "Registrando..." : "Registrar pago"}
          </button>
        </div>
      ))}
    </div>
  );
}
