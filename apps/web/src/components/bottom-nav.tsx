"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, PieChart, TrendingUp, MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";

import { TransactionSheet } from "@/components/transaction-sheet";
import { MoreSheet } from "@/components/more-sheet";

const TABS = [
  { href: "/dashboard", icon: Home, label: "Inicio", exact: true },
  { href: "/dashboard/gastos", icon: Wallet, label: "Gastos" },
  { href: "/dashboard/reportes", icon: TrendingUp, label: "Reportes" },
];

// Rutas que viven detrás del botón "Más": el tab se marca activo si estás en una.
const MORE_ROUTES = [
  "/dashboard/presupuestos",
  "/dashboard/metas",
  "/dashboard/suscripciones",
  "/dashboard/cuentas",
  "/dashboard/categorias",
  "/dashboard/ajustes",
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

export function BottomNav({
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
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md lg:hidden">
        <nav className="pointer-events-auto relative mx-3 mb-4 flex items-center justify-between rounded-3xl border border-border/50 bg-card/60 p-2 shadow-xl backdrop-blur-xl">
          {TABS.slice(0, 2).map((tab) => {
            const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-[10px] font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"}`}
              >
                {isActive && <div className="absolute inset-0 rounded-2xl bg-primary/10 dark:bg-primary/20" />}
                <tab.icon className={`z-10 h-5 w-5 transition-transform ${isActive ? "scale-110" : ""}`} />
                <span className="z-10">{tab.label}</span>
              </Link>
            );
          })}

          <button
            onClick={() => setSheetOpen(true)}
            className="mx-1 flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
            aria-label="Agregar movimiento"
          >
            <Plus className="h-7 w-7" />
          </button>

          {TABS.slice(2, 4).map((tab) => {
            const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-[10px] font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"}`}
              >
                {isActive && <div className="absolute inset-0 rounded-2xl bg-primary/10 dark:bg-primary/20" />}
                <tab.icon className={`z-10 h-5 w-5 transition-transform ${isActive ? "scale-110" : ""}`} />
                <span className="z-10">{tab.label}</span>
              </Link>
            );
          })}

          <button
            onClick={() => setMoreOpen(true)}
            className={`relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-[10px] font-medium transition-colors ${MORE_ROUTES.some((r) => pathname.startsWith(r)) ? "text-primary" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"}`}
            aria-label="Más secciones"
          >
            {MORE_ROUTES.some((r) => pathname.startsWith(r)) && <div className="absolute inset-0 rounded-2xl bg-primary/10 dark:bg-primary/20" />}
            <MoreHorizontal className="z-10 h-5 w-5" />
            <span className="z-10">Más</span>
          </button>
        </nav>
      </div>

      <TransactionSheet
        open={sheetOpen}
        onOpenChange={(o) => { if (!o) setSheetOpen(false) }}
        accounts={accounts}
        categories={categories}
        baseCurrency={baseCurrency}
      />

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
