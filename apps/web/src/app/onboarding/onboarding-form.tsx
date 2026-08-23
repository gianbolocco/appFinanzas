"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Check } from "lucide-react";

import { createClient } from "@/lib/supabase-browser";

const CURRENCIES = [
  { code: "ARS", label: "Peso argentino", symbol: "$" },
  { code: "USD", label: "Dólar", symbol: "US$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "BRL", label: "Real", symbol: "R$" },
  { code: "CLP", label: "Peso chileno", symbol: "CLP$" },
  { code: "COP", label: "Peso colombiano", symbol: "COL$" },
  { code: "MXN", label: "Peso mexicano", symbol: "MX$" },
  { code: "PEN", label: "Sol peruano", symbol: "S/" },
  { code: "UYU", label: "Peso uruguayo", symbol: "$U" },
];

const ACCOUNT_PRESETS = [
  { name: "Efectivo", type: "cash", icon: "banknote" },
  { name: "Cuenta bancaria", type: "bank", icon: "landmark" },
  { name: "Tarjeta de crédito", type: "credit_card", icon: "credit-card" },
  { name: "Tarjeta de débito", type: "debit_card", icon: "credit-card" },
  { name: "Billetera virtual", type: "wallet", icon: "smartphone" },
  { name: "Ahorro", type: "savings", icon: "piggy-bank" },
];

export function OnboardingForm({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("ARS");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(["Efectivo"]);

  function toggleAccount(name: string) {
    setSelectedAccounts((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name],
    );
  }

  async function finish() {
    setSaving(true);

    const { error: profileErr } = await supabase
      .from("users")
      .update({
        full_name: fullName || undefined,
        base_currency: baseCurrency,
        onboarded: true,
        onboarding_step: "done",
      })
      .eq("id", userId);

    if (profileErr) {
      setSaving(false);
      return;
    }

    const accountsToCreate = ACCOUNT_PRESETS.filter((a) =>
      selectedAccounts.includes(a.name),
    ).map((a) => ({
      user_id: userId,
      name: a.name,
      type: a.type,
      currency: baseCurrency,
      balance: 0,
    }));

    if (accountsToCreate.length > 0) {
      await supabase.from("accounts").insert(accountsToCreate);
    }

    setSaving(false);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition ${i <= step ? "bg-primary" : "bg-border"}`}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="flex flex-col gap-5">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Tu perfil</h2>
            <p className="text-sm text-muted-foreground">Contanos cómo llamarte.</p>
          </div>
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium">Nombre</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="¿Cómo te llamás?"
              className="h-12 rounded-xl border border-input bg-card px-4 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            onClick={() => setStep(1)}
            className="flex h-12 items-center justify-center gap-1 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90 active:scale-[0.98]"
          >
            Continuar <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-5">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Moneda base</h2>
            <p className="text-sm text-muted-foreground">
              Tus reportes se muestran en esta moneda. Podés cambiarla después.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                onClick={() => setBaseCurrency(c.code)}
                className={`flex items-center justify-between rounded-xl border p-4 text-left transition ${baseCurrency === c.code ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-accent"}`}
              >
                <div>
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.code} · {c.symbol}</p>
                </div>
                {baseCurrency === c.code && <Check className="h-5 w-5 text-primary" />}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStep(0)}
              className="flex h-12 flex-1 items-center justify-center rounded-full border border-border bg-card text-sm font-medium transition hover:bg-accent"
            >
              Atrás
            </button>
            <button
              onClick={() => setStep(2)}
              className="flex h-12 flex-1 items-center justify-center gap-1 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Continuar <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-5">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Tus cuentas</h2>
            <p className="text-sm text-muted-foreground">
              Elegí cuáles querés sumar. Podés agregar más después.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {ACCOUNT_PRESETS.map((a) => (
              <button
                key={a.name}
                onClick={() => toggleAccount(a.name)}
                className={`flex items-center justify-between rounded-xl border p-4 text-left transition ${selectedAccounts.includes(a.name) ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-accent"}`}
              >
                <span className="text-sm font-medium">{a.name}</span>
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${selectedAccounts.includes(a.name) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                >
                  {selectedAccounts.includes(a.name) && <Check className="h-3.5 w-3.5" />}
                </div>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="flex h-12 flex-1 items-center justify-center rounded-full border border-border bg-card text-sm font-medium transition hover:bg-accent"
            >
              Atrás
            </button>
            <button
              disabled={saving}
              onClick={finish}
              className="flex h-12 flex-1 items-center justify-center gap-1 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Listo"}
              {!saving && <Check className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
