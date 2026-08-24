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

      {/* Total mensual recurrente */}
      <section className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-sm">
        <p className="text-sm/none opacity-80">Gasto recurrente mensual</p>
        <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">
          {formatMoney(monthlyTotal, profile.base_currency)}
        </p>
        <p className="mt-2 text-sm opacity-80">
          Equivalente mensual de todas tus suscripciones activas
        </p>
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
