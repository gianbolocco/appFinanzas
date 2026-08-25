"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Target, RefreshCw, Landmark, Tags, Settings, X, PieChart, type LucideIcon } from "lucide-react";

const MORE_ITEMS: { href: string; icon: LucideIcon; label: string }[] = [
  { href: "/dashboard/presupuestos", icon: PieChart, label: "Presupuestos" },
  { href: "/dashboard/metas", icon: Target, label: "Metas de ahorro" },
  { href: "/dashboard/suscripciones", icon: RefreshCw, label: "Suscripciones" },
  { href: "/dashboard/cuentas", icon: Landmark, label: "Cuentas" },
  { href: "/dashboard/categorias", icon: Tags, label: "Categorías" },
  { href: "/dashboard/ajustes", icon: Settings, label: "Ajustes" },
];

export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 lg:hidden"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-background pb-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Más</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-accent"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <nav className="grid grid-cols-2 gap-3 p-4">
          {MORE_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex flex-col items-center justify-center gap-2.5 rounded-3xl p-5 text-center text-sm font-medium transition-all hover:scale-105 active:scale-95 ${isActive ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-card border border-border/50 hover:bg-accent shadow-sm"}`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
