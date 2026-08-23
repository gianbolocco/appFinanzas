import { Wallet, Send, PieChart, Settings, Plus, Home as HomeIcon, TrendingUp } from "lucide-react";

const sampleTx = [
  { icon: "🛒", label: "Supermercado", note: "Telegram", amount: -8450.5, cat: "Comida", color: "oklch(0.62 0.15 162)" },
  { icon: "☕", label: "Café", note: "Efectivo", amount: -1850, cat: "Ocio", color: "oklch(0.6 0.2 300)" },
  { icon: "💸", label: "Sueldo", note: "Transferencia", amount: 850000, cat: "Ingreso", color: "oklch(0.62 0.15 162)" },
  { icon: "🚌", label: "Subte", note: "Carga SUBE", amount: -1200, cat: "Transporte", color: "oklch(0.65 0.15 240)" },
];

function formatARS(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);
}

export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-6 px-5 pb-28 pt-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Wallet className="h-5 w-5" />
          </div>
          <span className="text-xl font-semibold tracking-tight">Guita</span>
        </div>
        <button className="text-sm font-medium text-muted-foreground">Ingresar</button>
      </header>

      <section className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">Saldo total</p>
        <p className="font-mono text-4xl font-semibold tracking-tight tabular-nums">
          $ 847.350,50
        </p>
        <p className="flex items-center gap-1 text-sm font-medium text-primary">
          <TrendingUp className="h-4 w-4" />
          +12,4% este mes
        </p>
      </section>

      <section className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm/none opacity-80">Cuenta principal</span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium">ARS</span>
        </div>
        <p className="mt-4 font-mono text-3xl font-semibold tabular-nums">$ 523.120,00</p>
        <div className="mt-5 flex gap-2">
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/15 py-2.5 text-sm font-medium backdrop-blur-sm transition hover:bg-white/25">
            <Send className="h-4 w-4" /> Enviar
          </button>
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/15 py-2.5 text-sm font-medium backdrop-blur-sm transition hover:bg-white/25">
            <Plus className="h-4 w-4" /> Cargar
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Últimos movimientos</h2>
          <button className="text-sm font-medium text-primary">Ver todo</button>
        </div>
        <div className="flex flex-col gap-1.5">
          {sampleTx.map((tx) => (
            <div
              key={tx.label}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
                style={{ backgroundColor: `color-mix(in oklch, ${tx.color} 15%, transparent)` }}
              >
                {tx.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{tx.label}</p>
                <p className="truncate text-xs text-muted-foreground">{tx.note} · {tx.cat}</p>
              </div>
              <p
                className={`font-mono text-sm font-semibold tabular-nums ${tx.amount > 0 ? "text-primary" : "text-foreground"}`}
              >
                {tx.amount > 0 ? "+" : ""}
                {formatARS(tx.amount)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-md">
        <nav className="pointer-events-auto mx-3 mb-3 flex items-center justify-around rounded-full border border-border bg-card/90 p-1.5 shadow-lg backdrop-blur-md">
          {[
            { icon: HomeIcon, label: "Inicio", active: true },
            { icon: Wallet, label: "Gastos" },
            { icon: PieChart, label: "Presup." },
            { icon: TrendingUp, label: "Reportes" },
            { icon: Settings, label: "Ajustes" },
          ].map((tab) => (
            <button
              key={tab.label}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[10px] font-medium ${tab.active ? "text-primary" : "text-muted-foreground"}`}
            >
              <tab.icon className={`h-5 w-5 ${tab.active ? "fill-primary/20" : ""}`} />
              {tab.label}
            </button>
          ))}
        </nav>
        <button className="pointer-events-auto absolute -top-6 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 active:scale-95">
          <Plus className="h-6 w-6" />
        </button>
      </div>
    </main>
  );
}
