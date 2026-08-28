import { BottomNav } from "@/components/bottom-nav";
import { Sidebar } from "@/components/sidebar";
import { getAccounts, getCategories } from "@/lib/queries";
import { getCurrentUser } from "@/lib/dal";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getCurrentUser();
  const [accounts, categories] = await Promise.all([getAccounts(), getCategories()]);

  const slimAccounts = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    currency: a.currency,
    balance: a.balance,
  }));
  const slimCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    parent_id: c.parent_id,
    icon: c.icon,
    color: c.color,
    is_predefined: c.is_predefined,
  }));

  return (
    <div className="flex min-h-svh w-full lg:pl-[260px]">
      <Sidebar
        accounts={slimAccounts}
        categories={slimCategories}
        baseCurrency={profile.base_currency}
      />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col lg:max-w-4xl">
        <main className="flex flex-1 flex-col px-5 pb-28 pt-8 lg:px-8 lg:pb-12 lg:pt-10">
          {children}
        </main>
        <BottomNav
          accounts={slimAccounts}
          categories={slimCategories}
          baseCurrency={profile.base_currency}
        />
      </div>
    </div>
  );
}
