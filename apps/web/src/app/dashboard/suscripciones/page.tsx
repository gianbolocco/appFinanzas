import { getSubscriptions, getSubscriptionsMonthlyTotal, getSubscriptionPayments, getCategories, getAccounts } from "@/lib/queries";
import { getCurrentUser } from "@/lib/dal";
import { formatMoney } from "@/lib/format";
import { SubscriptionList } from "./subscription-list";

export default async function SuscripcionesPage() {
  const { profile } = await getCurrentUser();
  const [subscriptions, monthlyTotal, categories, accounts] = await Promise.all([
    getSubscriptions(),
    getSubscriptionsMonthlyTotal(),
    getCategories(),
    getAccounts(),
  ]);

  // Traer historial de pagos para cada suscripción
  const paymentsBySubscription: Record<string, Awaited<ReturnType<typeof getSubscriptionPayments>>> = {};
  await Promise.all(
    subscriptions.map(async (s) => {
      try {
        paymentsBySubscription[s.id] = await getSubscriptionPayments(s.id);
      } catch {
        paymentsBySubscription[s.id] = [];
      }
    }),
  );

  const active = subscriptions.filter((s) => s.active);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold lg:text-2xl">Suscripciones</h1>
        <p className="text-sm text-muted-foreground">
          {active.length} activas · {subscriptions.length - active.length} pausadas
        </p>
      </header>

      <section className="relative overflow-hidden rounded-3xl border border-zinc-800/50 bg-zinc-950 p-6 text-zinc-50 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/20 via-transparent to-transparent"></div>
        
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Compromiso Mensual</p>
          <div className="mt-6 flex flex-col gap-5">
            {Object.keys(monthlyTotal).length > 0 ? (
              Object.entries(monthlyTotal).map(([cur, total], i, arr) => (
                <div key={cur} className={`flex items-end justify-between ${i !== arr.length - 1 ? "border-b border-zinc-800/50 pb-5" : ""}`}>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-zinc-400">Gasto en {cur}</p>
                    <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
                      {formatMoney(total, cur)}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-800/50 text-zinc-300 shadow-inner">
                    <span className="text-[10px] font-bold">{cur}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-end justify-between">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-zinc-400">Gasto en {profile.base_currency}</p>
                  <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
                    {formatMoney(0, profile.base_currency)}
                  </p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-800/50 text-zinc-300 shadow-inner">
                  <span className="text-[10px] font-bold">{profile.base_currency}</span>
                </div>
              </div>
            )}
          </div>
          <p className="mt-6 text-xs text-zinc-500">
            Equivalente mensual de todas tus suscripciones activas
          </p>
        </div>
      </section>

      <SubscriptionList
        subscriptions={subscriptions}
        categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))}
        baseCurrency={profile.base_currency}
        paymentsBySubscription={paymentsBySubscription as unknown as Record<string, { id: string; amount: number; currency: string; date: string; note: string | null; account: { name: string } | null }[]>}
      />
    </div>
  );
}
