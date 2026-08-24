"use client";

import { useState, useTransition } from "react";
import { Loader2, Check } from "lucide-react";

import { updateProfile } from "@/lib/actions";

const CURRENCIES = [
  { code: "ARS", label: "Peso argentino" },
  { code: "USD", label: "Dólar" },
  { code: "EUR", label: "Euro" },
  { code: "BRL", label: "Real" },
  { code: "CLP", label: "Peso chileno" },
  { code: "COP", label: "Peso colombiano" },
  { code: "MXN", label: "Peso mexicano" },
  { code: "PEN", label: "Sol peruano" },
  { code: "UYU", label: "Peso uruguayo" },
];

export function SettingsForm({
  fullName,
  baseCurrency,
}: {
  fullName: string | null;
  baseCurrency: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [currency, setCurrency] = useState(baseCurrency);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateProfile(fd);
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="full_name" className="text-sm font-medium">
          Nombre
        </label>
        <input
          id="full_name"
          name="full_name"
          required
          defaultValue={fullName ?? ""}
          maxLength={80}
          className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="base_currency" className="text-sm font-medium">
          Moneda base
        </label>
        <select
          id="base_currency"
          name="base_currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label} · {c.code}
            </option>
          ))}
        </select>
        {currency !== baseCurrency && (
          <p className="text-xs text-muted-foreground">
            Cambia la moneda en la que se muestran los totales. No reconvierte los
            movimientos que ya cargaste.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && !pending && (
        <p className="flex items-center gap-1.5 text-sm text-primary">
          <Check className="h-4 w-4" /> Guardado
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-xl bg-primary text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Guardar cambios"}
      </button>
    </form>
  );
}
