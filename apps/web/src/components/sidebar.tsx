"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, PieChart, TrendingUp, Settings, Plus, Landmark, Tags, Target, RefreshCw } from "lucide-react";
import { useState } from "react";

import { TransactionSheet } from "@/components/transaction-sheet";

const NAV_ITEMS = [
  { href: "/dashboard", icon: Home, label: "Inicio", exact: true },
  { href: "/dashboard/gastos", icon: Wallet, label: "Gastos" },
  { href: "/dashboard/presupuestos", icon: PieChart, label: "Presupuestos" },
  { href: "/dashboard/metas", icon: Target, label: "Metas" },
  { href: "/dashboard/suscripciones", icon: RefreshCw, label: "Suscripciones" },
  { href: "/dashboard/reportes", icon: TrendingUp, label: "Reportes" },
  { href: "/dashboard/cuentas", icon: Landmark, label: "Cuentas" },
  { href: "/dashboard/categorias", icon: Tags, label: "Categorías" },
  { href: "/dashboard/ajustes", icon: Settings, label: "Ajustes" },
];

type Account = { id: string; name: string; type: string; currency: string };
type Category = {
  id: string;
  name: string;
  kind: string;
  parent_id: string | null;
  icon: string | null;
  color: string;
  is_predefined: boolean;
};

export function Sidebar({
  accounts,
  categories,
  baseCurrency,
}: {
  accounts: Account[];
  categories: Category[];
  baseCurrency: string;
}) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card/50 p-4 lg:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-sm font-bold">G</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">Guita</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "fill-primary/20" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => setSheetOpen(true)}
          className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 active:scale-[0.98]"
        >
          <Plus className="h-5 w-5" />
          Agregar movimiento
        </button>
      </aside>

      <TransactionSheet
        open={sheetOpen}
        onOpenChange={(o) => { if (!o) setSheetOpen(false) }}
        accounts={accounts}
        categories={categories}
        baseCurrency={baseCurrency}
      />
    </>
  );
}
