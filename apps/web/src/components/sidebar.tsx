"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, PieChart, TrendingUp, Settings, Plus, Landmark, Tags, Target, RefreshCw } from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";

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
      <aside className="hidden w-[260px] shrink-0 flex-col border-r border-border/50 glass-panel p-4 lg:flex shadow-xl shadow-black/5 z-20">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-premium text-primary-foreground shadow-lg shadow-primary/20">
            <span className="text-base font-bold">G</span>
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
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl bg-primary/10 dark:bg-primary/20"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon className={`h-5 w-5 z-10 transition-transform group-hover:scale-110 ${isActive ? "fill-primary/20" : ""}`} />
                <span className="z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSheetOpen(true)}
          className="mt-6 flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-premium px-4 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-shadow hover:shadow-primary/40"
        >
          <Plus className="h-5 w-5" />
          Agregar movimiento
        </motion.button>
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
