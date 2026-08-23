import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/dal";

export default async function DashboardPage() {
  const { profile } = await getCurrentUser();

  if (!profile.onboarded) {
    redirect("/onboarding");
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Hola,</p>
          <h1 className="text-xl font-semibold">{profile.full_name ?? profile.email}</h1>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <span className="text-sm font-semibold">
            {(profile.full_name ?? profile.email ?? "?").charAt(0).toUpperCase()}
          </span>
        </div>
      </header>

      <section className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-sm">
        <p className="text-sm/none opacity-80">Saldo total</p>
        <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">$ 0,00</p>
        <p className="mt-2 text-sm opacity-80">Sin cuentas cargadas todavía</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Resumen del mes</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Ingresos</p>
            <p className="mt-1 font-mono text-lg font-semibold text-primary tabular-nums">$ 0,00</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Gastos</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">$ 0,00</p>
          </div>
        </div>
      </section>
    </div>
  );
}
