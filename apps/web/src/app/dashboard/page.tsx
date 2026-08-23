import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/dal";

export default async function DashboardPage() {
  const { profile } = await getCurrentUser();

  if (!profile.onboarded) {
    redirect("/onboarding");
  }

  const initial = (profile.full_name ?? profile.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Hola,</p>
          <h1 className="text-xl font-semibold lg:text-2xl">{profile.full_name ?? profile.email}</h1>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <span className="text-sm font-semibold">{initial}</span>
        </div>
      </header>

      <section className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-sm lg:p-6">
        <p className="text-sm/none opacity-80">Saldo total</p>
        <p className="mt-2 font-mono text-3xl font-semibold tabular-nums lg:text-4xl">$ 0,00</p>
        <p className="mt-2 text-sm opacity-80">Sin cuentas cargadas todavía</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Resumen del mes</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Ingresos</p>
            <p className="mt-1 font-mono text-lg font-semibold text-primary tabular-nums">$ 0,00</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Gastos</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">$ 0,00</p>
          </div>
          <div className="hidden rounded-2xl border border-border bg-card p-4 shadow-sm lg:block">
            <p className="text-xs text-muted-foreground">Ahorro</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">$ 0,00</p>
          </div>
          <div className="hidden rounded-2xl border border-border bg-card p-4 shadow-sm lg:block">
            <p className="text-xs text-muted-foreground">Presupuesto</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">$ 0,00</p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Últimos movimientos</h2>
          <button className="text-sm font-medium text-primary">Ver todo</button>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            Todavía no cargaste gastos este mes. Mandale uno por Telegram o tocá el botón verde.
          </p>
        </div>
      </section>
    </div>
  );
}
