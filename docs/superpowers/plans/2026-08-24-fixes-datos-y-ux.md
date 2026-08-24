# Corrección de integridad de datos y UX crítico — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar los defectos que corrompen saldos y reportes (transferencias, cuotas, multi-moneda, metas, suscripciones, fechas) y hacer la app usable desde el teléfono.

**Architecture:** La lógica de plata y fechas se extrae a funciones puras en `apps/web/src/lib/` con tests de Vitest; los server actions y las queries pasan a llamarlas. Los invariantes que la base puede sostener (idempotencia de pagos, distinción del padre de cuotas, obligatoriedad de `dest_amount`) se mueven a constraints e índices en una única migración `0005`, en vez de vivir como código de aplicación.

**Tech Stack:** Next.js 16 (App Router, Server Components + server actions), Supabase Postgres con RLS, Supabase Edge Functions (Deno), TypeScript estricto, Tailwind v4, Recharts, Vitest.

## Global Constraints

- Todo el texto de UI va en **español rioplatense** (voseo: "Elegí", "Cargá", "Poné"). Nunca "Elige"/"Carga".
- Los montos se formatean **siempre** con `formatMoney` / `formatSigned` de `@/lib/format`. Nunca `toLocaleString` suelto en un componente.
- Ningún archivo nuevo usa `any`. `pnpm typecheck` debe pasar limpio.
- Los server actions siguen el patrón existente: parsear con el schema de zod de `@/lib/schemas`, obtener el user con `supabase.auth.getUser()`, y cerrar con `revalidatePath`.
- Las queries en `@/lib/queries.ts` son `import "server-only"` y no reciben `user_id`: RLS ya filtra por `auth.uid()`.
- Los componentes de lista existentes son client components que reciben datos serializados desde la page. Mantener esa división.
- Fecha de referencia del proyecto: **2026-08-24**. La zona horaria del usuario es `America/Argentina/Buenos_Aires` (UTC−3).
- Cada tarea termina con un commit. Mensajes en español, sin tildes en la primera línea (convención del repo: ver `git log`).
- Nunca commitear claves. La `service_role` key va a Supabase Vault, jamás a una migración.

---

## File Structure

**Archivos nuevos:**

| Archivo | Responsabilidad |
|---|---|
| `apps/web/src/lib/dates.ts` | Fechas locales (`todayLocal`, límites de mes, avance de cadencia) |
| `apps/web/src/lib/money.ts` | Conversión entre monedas, reparto de cuotas, cuotas vencidas |
| `apps/web/src/lib/dates.test.ts` | Tests de `dates.ts` |
| `apps/web/src/lib/money.test.ts` | Tests de `money.ts` |
| `apps/web/vitest.config.ts` | Config de Vitest |
| `supabase/migrations/0005_data_integrity.sql` | Columnas, constraints, índices y backfill |
| `supabase/migrations/0006_exchange_rates_cron.sql` | `pg_cron` + `pg_net` para cotizaciones |
| `supabase/functions/exchange-rates-cron/index.ts` | Edge Function que puebla `exchange_rates` |
| `apps/web/src/components/more-sheet.tsx` | Hoja "Más" del bottom nav |
| `apps/web/src/components/theme-toggle.tsx` | Selector Claro/Oscuro/Automático |
| `apps/web/src/app/dashboard/ajustes/settings-form.tsx` | Edición de nombre y moneda base |
| `apps/web/src/app/dashboard/reportes/period-picker.tsx` | Selector de período de reportes |
| `apps/web/src/app/dashboard/loading.tsx` | Esqueleto de carga del dashboard |
| `apps/web/src/app/dashboard/error.tsx` | Pantalla de error del dashboard |
| `apps/web/src/app/dashboard/cuentas/[id]/not-found.tsx` | Cuenta inexistente |

**Archivos modificados en profundidad:** `apps/web/src/lib/actions.ts`, `apps/web/src/lib/queries.ts`, `apps/web/src/components/bottom-nav.tsx`, `apps/web/src/app/dashboard/reportes/page.tsx`.

**Archivos eliminados:** `apps/web/src/components/fab.tsx` (sin importadores), `apps/web/src/components/modal.tsx` (sin trackear y sin uso).

---

## Task 1: Utilidades puras de fecha y plata

Todo lo que sigue depende de estas funciones. Se hacen primero, con tests, porque son la única parte del sistema que se puede verificar sin una base de datos.

**Files:**
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/lib/dates.ts`
- Create: `apps/web/src/lib/money.ts`
- Test: `apps/web/src/lib/dates.test.ts`
- Test: `apps/web/src/lib/money.test.ts`
- Modify: `apps/web/package.json` (agregar script `test` y devDependency `vitest`)

**Interfaces:**
- Produces:
  - `todayLocal(now?: Date): string` — `YYYY-MM-DD` en hora local
  - `monthStartLocal(now?: Date): string`
  - `monthEndLocal(now?: Date): string`
  - `addMonthsIso(iso: string, months: number): string`
  - `addCadenceIso(iso: string, cadence: Cadence): string` donde `Cadence = "weekly" | "monthly" | "quarterly" | "yearly"`
  - `type Rate = { base: string; quote: string; rate: number }`
  - `convert(amount: number, from: string, to: string, rates: Rate[]): number | null`
  - `sumInBase(items: { balance: number; currency: string }[], base: string, rates: Rate[]): { total: number; partial: boolean }`
  - `splitInstallments(total: number, n: number): number[]`
  - `installmentDates(startIso: string, n: number): string[]`
  - `dueThrough(dates: string[], todayIso: string): number`

- [ ] **Step 1: Instalar Vitest y agregar el script de test**

```bash
cd apps/web && pnpm add -D vitest
```

Editar `apps/web/package.json`, agregando a `"scripts"`:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 2: Crear la config de Vitest**

Crear `apps/web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 3: Escribir los tests de fechas (deben fallar)**

Crear `apps/web/src/lib/dates.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { todayLocal, monthStartLocal, monthEndLocal, addMonthsIso, addCadenceIso } from "./dates";

describe("todayLocal", () => {
  it("usa la fecha local, no UTC", () => {
    // 24/08/2026 22:30 en UTC-3 es el 25/08 en UTC.
    // El usuario cargó el gasto el 24, así que debe decir 24.
    const localNight = new Date(2026, 7, 24, 22, 30, 0);
    expect(todayLocal(localNight)).toBe("2026-08-24");
  });

  it("rellena mes y dia con cero", () => {
    expect(todayLocal(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("monthStartLocal / monthEndLocal", () => {
  it("devuelve el primero y el ultimo dia del mes", () => {
    const d = new Date(2026, 7, 24, 22, 30, 0);
    expect(monthStartLocal(d)).toBe("2026-08-01");
    expect(monthEndLocal(d)).toBe("2026-08-31");
  });

  it("maneja febrero bisiesto", () => {
    const d = new Date(2028, 1, 10);
    expect(monthEndLocal(d)).toBe("2028-02-29");
  });
});

describe("addMonthsIso", () => {
  it("suma meses", () => {
    expect(addMonthsIso("2026-08-24", 1)).toBe("2026-09-24");
  });

  it("no desborda al mes siguiente cuando el dia no existe", () => {
    // 31 de enero + 1 mes debe ser 28 de febrero, no 3 de marzo.
    expect(addMonthsIso("2026-01-31", 1)).toBe("2026-02-28");
  });
});

describe("addCadenceIso", () => {
  it("avanza segun la cadencia", () => {
    expect(addCadenceIso("2026-08-24", "weekly")).toBe("2026-08-31");
    expect(addCadenceIso("2026-08-24", "monthly")).toBe("2026-09-24");
    expect(addCadenceIso("2026-08-24", "quarterly")).toBe("2026-11-24");
    expect(addCadenceIso("2026-08-24", "yearly")).toBe("2027-08-24");
  });
});
```

- [ ] **Step 4: Correr los tests y verificar que fallan**

Run: `cd apps/web && pnpm test`
Expected: FAIL — `Failed to resolve import "./dates"`.

- [ ] **Step 5: Implementar `dates.ts`**

Crear `apps/web/src/lib/dates.ts`:

```ts
export type Cadence = "weekly" | "monthly" | "quarterly" | "yearly";

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Fecha de hoy en la zona horaria del usuario. `toISOString()` daría UTC. */
export function todayLocal(now: Date = new Date()): string {
  return iso(now.getFullYear(), now.getMonth(), now.getDate());
}

export function monthStartLocal(now: Date = new Date()): string {
  return iso(now.getFullYear(), now.getMonth(), 1);
}

export function monthEndLocal(now: Date = new Date()): string {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return iso(last.getFullYear(), last.getMonth(), last.getDate());
}

/** Suma meses sin desbordar: 31/01 + 1 mes = 28/02, no 03/03. */
export function addMonthsIso(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return iso(target.getFullYear(), target.getMonth(), Math.min(d, lastDay));
}

export function addCadenceIso(isoDate: string, cadence: Cadence): string {
  if (cadence === "weekly") {
    const [y, m, d] = isoDate.split("-").map(Number);
    const next = new Date(y, m - 1, d + 7);
    return iso(next.getFullYear(), next.getMonth(), next.getDate());
  }
  const months = cadence === "monthly" ? 1 : cadence === "quarterly" ? 3 : 12;
  return addMonthsIso(isoDate, months);
}
```

- [ ] **Step 6: Correr los tests de fechas y verificar que pasan**

Run: `cd apps/web && pnpm test`
Expected: PASS — 6 tests en `dates.test.ts`.

- [ ] **Step 7: Escribir los tests de plata (deben fallar)**

Crear `apps/web/src/lib/money.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { convert, sumInBase, splitInstallments, installmentDates, dueThrough, type Rate } from "./money";

const rates: Rate[] = [
  { base: "USD", quote: "ARS", rate: 1200 },
  { base: "USD", quote: "EUR", rate: 0.9 },
];

describe("convert", () => {
  it("devuelve el mismo monto si la moneda no cambia", () => {
    expect(convert(100, "ARS", "ARS", rates)).toBe(100);
  });

  it("usa el rate directo", () => {
    expect(convert(2, "USD", "ARS", rates)).toBe(2400);
  });

  it("usa el rate inverso", () => {
    expect(convert(2400, "ARS", "USD", rates)).toBe(2);
  });

  it("triangula por USD cuando no hay rate directo", () => {
    // 1200 ARS -> 1 USD -> 0.9 EUR
    expect(convert(1200, "ARS", "EUR", rates)).toBeCloseTo(0.9, 6);
  });

  it("devuelve null cuando falta el rate, en vez de asumir 1", () => {
    expect(convert(100, "BRL", "ARS", [])).toBeNull();
  });
});

describe("sumInBase", () => {
  it("convierte antes de sumar", () => {
    const r = sumInBase(
      [
        { balance: 100000, currency: "ARS" },
        { balance: 100, currency: "USD" },
      ],
      "ARS",
      rates,
    );
    expect(r.total).toBe(220000);
    expect(r.partial).toBe(false);
  });

  it("marca el total como parcial si falta un rate", () => {
    const r = sumInBase(
      [
        { balance: 1000, currency: "ARS" },
        { balance: 50, currency: "BRL" },
      ],
      "ARS",
      rates,
    );
    expect(r.total).toBe(1000);
    expect(r.partial).toBe(true);
  });

  it("una lista vacia suma cero y no es parcial", () => {
    expect(sumInBase([], "ARS", rates)).toEqual({ total: 0, partial: false });
  });
});

describe("splitInstallments", () => {
  it("reparte sin perder centavos", () => {
    const parts = splitInstallments(100, 3);
    expect(parts).toHaveLength(3);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("pone la diferencia en la primera cuota", () => {
    expect(splitInstallments(100, 3)).toEqual([33.34, 33.33, 33.33]);
  });

  it("una sola cuota es el total", () => {
    expect(splitInstallments(4500, 1)).toEqual([4500]);
  });
});

describe("installmentDates", () => {
  it("genera una fecha por cuota, mes a mes", () => {
    expect(installmentDates("2026-08-24", 3)).toEqual(["2026-08-24", "2026-09-24", "2026-10-24"]);
  });
});

describe("dueThrough", () => {
  it("cuenta las cuotas ya vencidas incluyendo hoy", () => {
    const dates = ["2026-08-24", "2026-09-24", "2026-10-24"];
    expect(dueThrough(dates, "2026-08-24")).toBe(1);
    expect(dueThrough(dates, "2026-09-30")).toBe(2);
    expect(dueThrough(dates, "2026-12-01")).toBe(3);
  });

  it("es cero si la primera cuota todavia no vencio", () => {
    expect(dueThrough(["2026-09-01"], "2026-08-24")).toBe(0);
  });
});
```

- [ ] **Step 8: Correr los tests y verificar que fallan**

Run: `cd apps/web && pnpm test`
Expected: FAIL — `Failed to resolve import "./money"`.

- [ ] **Step 9: Implementar `money.ts`**

Crear `apps/web/src/lib/money.ts`:

```ts
import { addMonthsIso } from "@/lib/dates";

export type Rate = { base: string; quote: string; rate: number };

const PIVOT = "USD";

function directRate(from: string, to: string, rates: Rate[]): number | null {
  const direct = rates.find((r) => r.base === from && r.quote === to);
  if (direct) return direct.rate;
  const inverse = rates.find((r) => r.base === to && r.quote === from);
  if (inverse && inverse.rate !== 0) return 1 / inverse.rate;
  return null;
}

/**
 * Convierte entre monedas usando rate directo, inverso, o triangulando por USD.
 * Devuelve null si no alcanza la información: quien llama decide qué hacer,
 * en vez de recibir un 1 silencioso que corrompe el número.
 */
export function convert(amount: number, from: string, to: string, rates: Rate[]): number | null {
  if (from === to) return amount;

  const direct = directRate(from, to, rates);
  if (direct !== null) return amount * direct;

  const toPivot = directRate(from, PIVOT, rates);
  const fromPivot = directRate(PIVOT, to, rates);
  if (toPivot !== null && fromPivot !== null) return amount * toPivot * fromPivot;

  return null;
}

/**
 * Suma saldos de monedas mixtas convirtiendo a `base`.
 * `partial: true` significa que se omitió al menos un saldo por falta de rate.
 */
export function sumInBase(
  items: { balance: number; currency: string }[],
  base: string,
  rates: Rate[],
): { total: number; partial: boolean } {
  let total = 0;
  let partial = false;
  for (const item of items) {
    const converted = convert(item.balance, item.currency, base, rates);
    if (converted === null) partial = true;
    else total += converted;
  }
  return { total, partial };
}

/**
 * Reparte un total en n cuotas de 2 decimales sin perder centavos:
 * la diferencia por redondeo se acumula en la primera cuota.
 */
export function splitInstallments(total: number, n: number): number[] {
  const cents = Math.round(total * 100);
  const each = Math.floor(cents / n);
  const remainder = cents - each * n;
  return Array.from({ length: n }, (_, i) => (i === 0 ? each + remainder : each) / 100);
}

export function installmentDates(startIso: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addMonthsIso(startIso, i));
}

/** Cuántas de esas fechas ya vencieron (incluye hoy). */
export function dueThrough(dates: string[], todayIso: string): number {
  return dates.filter((d) => d <= todayIso).length;
}
```

- [ ] **Step 10: Correr todos los tests y verificar que pasan**

Run: `cd apps/web && pnpm test`
Expected: PASS — 6 tests en `dates.test.ts` + 13 en `money.test.ts` = 19 pasando.

- [ ] **Step 11: Verificar tipos**

Run: `cd apps/web && pnpm typecheck`
Expected: sin errores.

- [ ] **Step 12: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/package.json apps/web/src/lib/dates.ts apps/web/src/lib/money.ts apps/web/src/lib/dates.test.ts apps/web/src/lib/money.test.ts pnpm-lock.yaml
git commit -m "Fix: utilidades puras de fecha local y conversion de moneda

- todayLocal/monthStartLocal/monthEndLocal: fechas en hora local, no UTC
- addMonthsIso no desborda cuando el dia no existe en el mes destino
- convert() triangula por USD y devuelve null si falta el rate
- splitInstallments reparte sin perder centavos
- Vitest instalado con 19 tests"
```

---

## Task 2: Migración 0005 — invariantes en la base

Mueve a Postgres lo que hoy son (o deberían ser) chequeos de aplicación, y colapsa los pares de transferencia existentes en una fila.

**Files:**
- Create: `supabase/migrations/0005_data_integrity.sql`
- Modify: `supabase/migrations/0004_subscription_link.sql:5` (typo)

**Interfaces:**
- Produces: columnas `transactions.dest_amount`, `transactions.goal_id`, `transactions.is_installment_parent` (generada), índice único `uq_subscription_payment_per_day`.

- [ ] **Step 1: Corregir el typo de la migración 0004**

En `supabase/migrations/0004_subscription_link.sql`, línea 5, reemplazar el comentario que tiene caracteres chinos incrustados:

```sql
-- Agregar subscription_id a transactions para rastrear pagos de suscripciones
```

- [ ] **Step 2: Escribir la migración 0005**

Crear `supabase/migrations/0005_data_integrity.sql`:

```sql
-- ============================================================================
-- Guita — Migración 0005: integridad de transferencias, cuotas, metas y pagos
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Columnas nuevas
-- ----------------------------------------------------------------------------

-- Monto acreditado en la cuenta destino de una transferencia.
-- Permite guardar la transferencia como UNA fila aunque las monedas difieran:
-- `amount` queda en la moneda del origen, `dest_amount` en la del destino.
alter table public.transactions
  add column if not exists dest_amount numeric(18,2);

-- Vincula una transacción con la meta de ahorro que la originó.
-- Espejo del patrón ya usado por subscription_id (migración 0004).
alter table public.transactions
  add column if not exists goal_id uuid references public.goals(id) on delete set null;

-- El "padre" de una compra en cuotas: lleva el monto total y ninguna cuota.
-- No debe listarse ni sumarse nunca; solo sirve para reconstruir la compra.
alter table public.transactions
  add column if not exists is_installment_parent boolean
    generated always as (installments_total is not null and installment_number is null) stored;

-- ----------------------------------------------------------------------------
-- 2. Backfill: colapsar los pares expense+income en una sola fila transfer
-- ----------------------------------------------------------------------------
-- Hasta ahora una transferencia se guardaba como dos filas creadas por
-- createTransaction, reconocibles por sus notas y sus cuentas cruzadas.
-- Idempotente: al terminar no quedan filas que matcheen el patrón.

with pares as (
  select
    e.id     as expense_id,
    i.id     as income_id,
    i.amount as dest_amount
  from public.transactions e
  join public.transactions i
    on  i.user_id       = e.user_id
    and i.date          = e.date
    and i.account_id    = e.to_account_id
    and i.to_account_id = e.account_id
    and i.type          = 'income'
    and i.note like 'Transfer ←%'
  where e.type = 'expense'
    and e.to_account_id is not null
    and e.note like 'Transfer →%'
),
actualizadas as (
  update public.transactions t
     set type        = 'transfer',
         dest_amount = p.dest_amount
    from pares p
   where t.id = p.expense_id
  returning p.income_id
)
delete from public.transactions
 where id in (select income_id from actualizadas);

-- Cualquier transferencia preexistente que ya fuera type='transfer'
-- (no debería haber ninguna) queda con dest_amount = amount.
update public.transactions
   set dest_amount = amount
 where type = 'transfer'
   and dest_amount is null;

-- ----------------------------------------------------------------------------
-- 3. Constraints (después del backfill, para que los datos viejos los cumplan)
-- ----------------------------------------------------------------------------

alter table public.transactions
  drop constraint if exists transactions_transfer_needs_dest_amount;

alter table public.transactions
  add constraint transactions_transfer_needs_dest_amount
  check (type <> 'transfer' or dest_amount is not null);

-- ----------------------------------------------------------------------------
-- 4. Índices
-- ----------------------------------------------------------------------------

create index if not exists idx_transactions_goal
  on public.transactions(goal_id) where goal_id is not null;

-- Cubre la consulta más frecuente: movimientos del usuario por fecha,
-- excluyendo los padres de cuotas.
create index if not exists idx_transactions_listable
  on public.transactions(user_id, date desc) where is_installment_parent = false;

-- Idempotencia del registro de pagos: un pago por suscripción por día.
-- Es la base la que lo garantiza, no el código de aplicación.
create unique index if not exists uq_subscription_payment_per_day
  on public.transactions(subscription_id, date) where subscription_id is not null;
```

- [ ] **Step 3: Aplicar la migración**

Abrir el SQL Editor de Supabase (dashboard → SQL Editor → New query), pegar el
contenido completo de `0005_data_integrity.sql` y ejecutar.

Expected: `Success. No rows returned`.

Si el proyecto está enlazado con la CLI, alternativamente:

```bash
supabase db push
```

- [ ] **Step 4: Verificar el resultado del backfill**

Ejecutar en el SQL Editor:

```sql
-- No deben quedar pares sin colapsar
select count(*) as pares_pendientes
from public.transactions
where note like 'Transfer ←%' and type = 'income';

-- Toda transferencia tiene dest_amount
select count(*) as transferencias_sin_dest
from public.transactions
where type = 'transfer' and dest_amount is null;

-- La columna generada distingue padres
select is_installment_parent, count(*)
from public.transactions
group by 1;
```

Expected: `pares_pendientes = 0`, `transferencias_sin_dest = 0`, y el conteo
agrupado muestra `false` para las cuotas hijas y `true` solo para los padres.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_data_integrity.sql supabase/migrations/0004_subscription_link.sql
git commit -m "Migracion 0005: dest_amount, goal_id, is_installment_parent e idempotencia de pagos

- dest_amount permite guardar una transferencia como una sola fila
- Backfill que colapsa los pares expense+income existentes
- is_installment_parent (columna generada) para excluir el padre de cuotas
- Indice unico (subscription_id, date): idempotencia garantizada por la base
- goal_id para vincular aportes a metas con su transaccion
- Typo en el comentario de la migracion 0004"
```

---

## Task 3: Transferencias como una sola fila

Elimina de raíz los defectos D1, D2 y D5 del spec: sin contrapartida separada, no hay nada que buscar por heurística ni que se cuente como ingreso/gasto.

**Files:**
- Modify: `apps/web/src/lib/actions.ts` (`createTransaction`, `updateTransaction`, `deleteTransaction`)
- Modify: `apps/web/src/lib/queries.ts` (`getAccountMonthlyStats`, `getAccountBalanceAtDate`, `getMonthlySummary`)
- Modify: `apps/web/src/app/dashboard/cuentas/[id]/account-tx-list.tsx`

**Interfaces:**
- Consumes: `todayLocal`, `monthStartLocal` de Task 1.
- Produces: helper interno `applyBalance(supabase, accountId, delta)` reutilizado por las tareas 4, 6 y 7.

- [ ] **Step 1: Agregar el helper de ajuste de saldo al final de `actions.ts`**

En `apps/web/src/lib/actions.ts`, junto a `fetchRate`, agregar:

```ts
/**
 * Ajusta el saldo de una cuenta sumando `delta` (negativo para restar).
 * ponytail: read-modify-write sin transaccion; con un solo usuario alcanza.
 * Si algun dia hay escrituras concurrentes, mover a una funcion Postgres.
 */
async function applyBalance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string | null,
  delta: number,
): Promise<void> {
  if (!accountId || delta === 0) return;
  const { data: acc } = await supabase
    .from("accounts")
    .select("balance")
    .eq("id", accountId)
    .single();
  if (!acc) return;
  await supabase
    .from("accounts")
    .update({ balance: acc.balance + delta })
    .eq("id", accountId);
}
```

- [ ] **Step 2: Reemplazar la rama de transferencia en `createTransaction`**

En `apps/web/src/lib/actions.ts`, dentro de `createTransaction`, borrar el bloque
completo `} else if (parsed.type === "transfer" && parsed.to_account_id) {` que
inserta las dos transacciones (gasto en origen + ingreso en destino), y
reemplazarlo por:

```ts
  } else if (parsed.type === "transfer" && parsed.to_account_id) {
    // Una transferencia es UNA fila: origen en account_id, destino en to_account_id.
    // amount queda en la moneda del origen; dest_amount en la del destino.
    const destRate = Number(formData.get("dest_rate") ?? "1") || 1;
    const destAmount = Math.round(parsed.amount * destRate * 100) / 100;

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: "transfer",
      amount: parsed.amount,
      currency: parsed.currency,
      dest_amount: destAmount,
      amount_base: amountBase,
      exchange_rate: rate,
      account_id: parsed.account_id,
      to_account_id: parsed.to_account_id,
      note: parsed.note,
      date: parsed.date,
      source: "manual",
    });
    if (error) throw error;
```

- [ ] **Step 3: Reemplazar el bloque de ajuste de saldos de `createTransaction`**

Más abajo en la misma función, borrar el bloque completo que arranca con el
comentario `// Ajustar saldos: ahora las transferencias son expense (origen) + income (destino),`
hasta el cierre de su `else if`, y reemplazarlo por:

```ts
  // Ajustar saldos
  if (parsed.type === "transfer" && parsed.to_account_id) {
    const destRate = Number(formData.get("dest_rate") ?? "1") || 1;
    const destAmount = Math.round(parsed.amount * destRate * 100) / 100;
    await applyBalance(supabase, parsed.account_id, -parsed.amount);
    await applyBalance(supabase, parsed.to_account_id, destAmount);
  } else if (!installments) {
    const sign = parsed.type === "income" ? 1 : -1;
    await applyBalance(supabase, parsed.account_id, sign * parsed.amount);
  }
  // El caso `installments` ajusta su propio saldo en la Task 4.
```

- [ ] **Step 4: Simplificar `deleteTransaction`**

En `apps/web/src/lib/actions.ts`, reemplazar el cuerpo de `deleteTransaction`
desde la línea `// Si es parte de una transferencia (tiene to_account_id), buscar y borrar la contrapartida`
hasta el `for (const id of pairedIds)` inclusive, por:

```ts
  // Revertir saldos. Una transferencia es una sola fila: revierte las dos puntas.
  if (tx.type === "transfer") {
    await applyBalance(supabase, tx.account_id, tx.amount);
    await applyBalance(supabase, tx.to_account_id, -(tx.dest_amount ?? tx.amount));
  } else {
    const sign = tx.type === "income" ? -1 : 1;
    await applyBalance(supabase, tx.account_id, sign * tx.amount);
  }

  const { error } = await supabase.from("transactions").delete().eq("id", transactionId);
  if (error) throw error;
```

Borrar también la declaración `const pairedIds: string[] = [transactionId];` y el
bloque de revertido de saldo de la transacción principal que quedaba abajo.

- [ ] **Step 5: Simplificar `updateTransaction`**

En `apps/web/src/lib/actions.ts`, dentro de `updateTransaction`:

Reemplazar el paso 1 (revertir saldo original + borrar contrapartida) por:

```ts
  // 1. Revertir el efecto de la transacción original sobre los saldos
  if (original.type === "transfer") {
    await applyBalance(supabase, original.account_id, original.amount);
    await applyBalance(supabase, original.to_account_id, -(original.dest_amount ?? original.amount));
  } else {
    const origSign = original.type === "income" ? -1 : 1;
    await applyBalance(supabase, original.account_id, origSign * original.amount);
  }
```

Reemplazar el paso 2 (`.update({...})`) por:

```ts
  // 2. Actualizar la fila
  const destRate = Number(formData.get("dest_rate") ?? "1") || 1;
  const destAmount = Math.round(parsed.amount * destRate * 100) / 100;
  const isTransfer = parsed.type === "transfer" && !!parsed.to_account_id;

  const { error: updateErr } = await supabase
    .from("transactions")
    .update({
      type: parsed.type,
      amount: parsed.amount,
      currency: parsed.currency,
      dest_amount: isTransfer ? destAmount : null,
      amount_base: amountBase,
      exchange_rate: rate,
      category_id: isTransfer ? null : parsed.category_id,
      account_id: parsed.account_id,
      to_account_id: isTransfer ? parsed.to_account_id : null,
      note: parsed.note,
      date: parsed.date,
    })
    .eq("id", transactionId);
  if (updateErr) throw updateErr;
```

Borrar por completo el paso 3 (`// 3. Si es transferencia, crear la contrapartida`)
y reemplazar el paso 4 por:

```ts
  // 3. Aplicar el efecto de la transacción actualizada
  if (isTransfer) {
    await applyBalance(supabase, parsed.account_id, -parsed.amount);
    await applyBalance(supabase, parsed.to_account_id, destAmount);
  } else {
    const newSign = parsed.type === "income" ? 1 : -1;
    await applyBalance(supabase, parsed.account_id, newSign * parsed.amount);
  }
```

- [ ] **Step 6: Corregir `getAccountMonthlyStats`**

En `apps/web/src/lib/queries.ts`, reemplazar la función completa por:

```ts
export async function getAccountMonthlyStats(accountId: string) {
  const supabase = await createClient();
  const from = monthStartLocal();

  // Movimientos donde esta cuenta es el origen
  const { data: outgoing, error } = await supabase
    .from("transactions")
    .select("type, amount")
    .eq("account_id", accountId)
    .eq("is_installment_parent", false)
    .gte("date", from);

  if (error) throw error;

  let income = 0;
  let expense = 0;
  let transferOut = 0;

  for (const t of outgoing ?? []) {
    if (t.type === "income") income += t.amount;
    else if (t.type === "expense") expense += t.amount;
    else if (t.type === "transfer") transferOut += t.amount;
  }

  // Transferencias entrantes: dest_amount ya está en la moneda de esta cuenta.
  // No se multiplica por exchange_rate (ese rate convierte a moneda base).
  const { data: incoming } = await supabase
    .from("transactions")
    .select("amount, dest_amount")
    .eq("to_account_id", accountId)
    .eq("type", "transfer")
    .gte("date", from);

  const transferIn = (incoming ?? []).reduce((s, t) => s + (t.dest_amount ?? t.amount), 0);

  return { income, expense, transferIn, transferOut };
}
```

- [ ] **Step 7: Corregir `getAccountBalanceAtDate`**

En `apps/web/src/lib/queries.ts`, reemplazar la función completa por:

```ts
export async function getAccountBalanceAtDate(accountId: string, date: string) {
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("accounts")
    .select("balance")
    .eq("id", accountId)
    .single();
  if (!account) return 0;

  // Deshacer los movimientos posteriores a `date` para retroceder el saldo.
  const { data: outgoing } = await supabase
    .from("transactions")
    .select("type, amount")
    .eq("account_id", accountId)
    .eq("is_installment_parent", false)
    .gt("date", date);

  const { data: incoming } = await supabase
    .from("transactions")
    .select("amount, dest_amount")
    .eq("to_account_id", accountId)
    .eq("type", "transfer")
    .gt("date", date);

  let delta = 0;
  for (const t of outgoing ?? []) {
    if (t.type === "income") delta -= t.amount;
    else delta += t.amount; // expense y transfer salieron de esta cuenta
  }
  for (const t of incoming ?? []) {
    delta -= t.dest_amount ?? t.amount;
  }

  return account.balance + delta;
}
```

- [ ] **Step 8: Excluir transferencias del resumen mensual**

En `apps/web/src/lib/queries.ts`, en `getMonthlySummary`, reemplazar la query y el
bucle por:

```ts
  const { data, error } = await supabase
    .from("transactions")
    .select("type, amount, amount_base")
    .in("type", ["income", "expense"])
    .eq("is_installment_parent", false)
    .gte("date", from);

  if (error) throw error;

  const summary = { income: 0, expense: 0, incomeBase: 0, expenseBase: 0 };
  for (const t of data ?? []) {
    if (t.type === "income") {
      summary.income += t.amount;
      summary.incomeBase += t.amount_base;
    } else {
      summary.expense += t.amount;
      summary.expenseBase += t.amount_base;
    }
  }
```

Y reemplazar la línea que calcula `from` por `const from = monthStartLocal();`.

- [ ] **Step 9: Importar los helpers de fecha en `queries.ts`**

En la cabecera de `apps/web/src/lib/queries.ts`, agregar bajo los imports existentes:

```ts
import { monthStartLocal } from "@/lib/dates";
```

- [ ] **Step 10: Mostrar el monto correcto en la vista de cuenta**

En `apps/web/src/app/dashboard/cuentas/[id]/account-tx-list.tsx`:

Agregar `dest_amount: number | null;` al tipo `Tx`.

Reemplazar el cálculo de `signed` dentro del `.map` por:

```ts
            const isIncoming = t.type === "income" || (t.type === "transfer" && t.to_account_id === accountId);
            // En una transferencia entrante se acreditó dest_amount, no amount.
            const shown = isIncoming && t.type === "transfer" ? (t.dest_amount ?? t.amount) : t.amount;
            const signed = isIncoming ? shown : -shown;
```

Y reemplazar los subtotales para que usen `formatMoney` y contemplen `dest_amount`:

```ts
  const incomeTotal = filtered
    .filter((t) => t.type === "income" || (t.type === "transfer" && t.to_account_id === accountId))
    .reduce((s, t) => s + (t.type === "transfer" ? (t.dest_amount ?? t.amount) : t.amount), 0);
  const expenseTotal = filtered
    .filter((t) => t.type === "expense" || (t.type === "transfer" && t.account_id === accountId))
    .reduce((s, t) => s + t.amount, 0);
```

Reemplazar los dos `toLocaleString` del bloque de subtotales por
`formatMoney(incomeTotal, accountCurrency ?? "ARS")` y
`formatMoney(expenseTotal, accountCurrency ?? "ARS")`, agregando `formatMoney` al
import de `@/lib/format` y usando el prop `accountCurrency` que la función ya
recibe pero descarta.

- [ ] **Step 11: Verificar tipos y lint**

Run: `cd apps/web && pnpm typecheck && pnpm lint`
Expected: sin errores.

- [ ] **Step 12: Verificar a mano en la app**

Run: `pnpm dev` desde la raíz, abrir http://localhost:3000

1. Anotar el "Ingresos" y "Gastos" del mes en el dashboard.
2. Crear una transferencia de $10.000 entre dos cuentas propias.
3. Volver al dashboard: Ingresos y Gastos deben ser **los mismos números**.
4. Ir a Movimientos: la transferencia aparece **una sola vez**, tipo "Transfer".
5. Filtrar por tipo "Transfer": la encuentra.
6. Los saldos de ambas cuentas cambiaron en $10.000, uno para arriba y otro para abajo.
7. Borrar la transferencia: los dos saldos vuelven a su valor original.

- [ ] **Step 13: Commit**

```bash
git add apps/web/src/lib/actions.ts apps/web/src/lib/queries.ts "apps/web/src/app/dashboard/cuentas/[id]/account-tx-list.tsx"
git commit -m "Fix: transferencias como una sola fila type=transfer

- createTransaction inserta una fila con dest_amount en vez de un par expense+income
- Las transferencias dejan de contarse como ingreso y gasto del mes
- delete/update ya no buscan la contrapartida por (origen, destino, fecha):
  dos transferencias el mismo dia entre las mismas cuentas eran indistinguibles
- getAccountMonthlyStats y getAccountBalanceAtDate dejan de multiplicar
  dest_amount por exchange_rate (la conversion ya estaba aplicada)
- Helper applyBalance para el ajuste de saldos"
```

---

## Task 4: Cuotas que se cuentan una sola vez

**Files:**
- Modify: `apps/web/src/lib/actions.ts` (`createTransaction`, `deleteTransaction`)
- Modify: `apps/web/src/lib/queries.ts` (`getTransactions`, `getAccountTransactions`, `getBudgets`, `getCategoryBreakdown`, `getMonthlyTrends`, `getMonthComparison`, `getBreakdownByAccount`)

**Interfaces:**
- Consumes: `splitInstallments`, `installmentDates`, `dueThrough` de Task 1; `applyBalance` de Task 3.

- [ ] **Step 1: Importar los helpers en `actions.ts`**

En la cabecera de `apps/web/src/lib/actions.ts`:

```ts
import { todayLocal, addCadenceIso } from "@/lib/dates";
import { splitInstallments, installmentDates, dueThrough } from "@/lib/money";
```

- [ ] **Step 2: Reescribir la rama de cuotas de `createTransaction`**

En `apps/web/src/lib/actions.ts`, reemplazar el bloque `if (installments) { ... }`
completo por:

```ts
  if (installments) {
    // El padre guarda la compra original: monto total, sin número de cuota.
    // is_installment_parent (columna generada) lo excluye de listas y agregados.
    const { data: parent, error: parentErr } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        type: parsed.type,
        amount: parsed.amount,
        currency: parsed.currency,
        amount_base: amountBase,
        exchange_rate: rate,
        category_id: parsed.category_id,
        account_id: parsed.account_id,
        note: parsed.note,
        date: parsed.date,
        source: "manual",
        installments_total: installmentsCount,
      })
      .select()
      .single();
    if (parentErr) throw parentErr;

    const amounts = splitInstallments(parsed.amount, installmentsCount);
    const bases = splitInstallments(amountBase, installmentsCount);
    const dates = installmentDates(parsed.date, installmentsCount);

    const children = amounts.map((amount, i) => ({
      user_id: user.id,
      type: parsed.type,
      amount,
      currency: parsed.currency,
      amount_base: bases[i],
      exchange_rate: rate,
      category_id: parsed.category_id,
      account_id: parsed.account_id,
      note: parsed.note
        ? `${parsed.note} (cuota ${i + 1}/${installmentsCount})`
        : `Cuota ${i + 1}/${installmentsCount}`,
      date: dates[i],
      source: "manual",
      installments_total: installmentsCount,
      installment_number: i + 1,
      parent_transaction_id: parent.id,
    }));

    const { error: childErr } = await supabase.from("transactions").insert(children);
    if (childErr) throw childErr;

    // El saldo se mueve por cuota vencida, no por el total de la compra.
    const vencidas = dueThrough(dates, todayLocal());
    const montoVencido = amounts.slice(0, vencidas).reduce((s, a) => s + a, 0);
    const sign = parsed.type === "income" ? 1 : -1;
    await applyBalance(supabase, parsed.account_id, sign * montoVencido);
  } else if (parsed.type === "transfer" && parsed.to_account_id) {
```

- [ ] **Step 3: Corregir el revertido de saldo al borrar una compra en cuotas**

En `apps/web/src/lib/actions.ts`, dentro de `deleteTransaction`, reemplazar el
bloque de revertido de saldos escrito en la Task 3 por:

```ts
  // Revertir saldos.
  if (tx.is_installment_parent) {
    // Se restaron solo las cuotas vencidas al crear: hay que devolver eso mismo,
    // no el total de la compra. Las hijas se van por cascade.
    const { data: children } = await supabase
      .from("transactions")
      .select("amount, date")
      .eq("parent_transaction_id", tx.id);

    const today = todayLocal();
    const montoVencido = (children ?? [])
      .filter((c) => c.date <= today)
      .reduce((s, c) => s + c.amount, 0);
    const sign = tx.type === "income" ? -1 : 1;
    await applyBalance(supabase, tx.account_id, sign * montoVencido);
  } else if (tx.type === "transfer") {
    await applyBalance(supabase, tx.account_id, tx.amount);
    await applyBalance(supabase, tx.to_account_id, -(tx.dest_amount ?? tx.amount));
  } else {
    const sign = tx.type === "income" ? -1 : 1;
    await applyBalance(supabase, tx.account_id, sign * tx.amount);
  }
```

- [ ] **Step 4: Excluir el padre de todas las queries de lectura**

En `apps/web/src/lib/queries.ts`, agregar `.eq("is_installment_parent", false)` a
la cadena de estas funciones, inmediatamente después del `.select(...)`:

- `getTransactions`
- `getAccountTransactions`
- `getBudgets` (en la query de `expenses`)
- `getCategoryBreakdown`
- `getBreakdownByAccount`
- `getMonthComparison` (en las dos queries del `Promise.all`)
- `getMonthlyTrends` (en la query dentro del `months.map`)

Ejemplo para `getTransactions`:

```ts
  let q = supabase
    .from("transactions")
    .select(
      "*, category:categories(*), account:accounts!transactions_account_id_fkey(*), to_account:accounts!transactions_to_account_id_fkey(*)",
    )
    .eq("is_installment_parent", false)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
```

- [ ] **Step 5: Excluir transferencias de los agregados de gasto e ingreso**

En `apps/web/src/lib/queries.ts`, agregar el filtro por tipo a las funciones que
suman ingresos o gastos, para que una transferencia nunca aparezca como ninguno
de los dos:

- `getMonthComparison`: agregar `.in("type", ["income", "expense"])` a ambas queries.
- `getMonthlyTrends`: agregar `.in("type", ["income", "expense"])` a la query interna.
- `getBudgets`: ya filtra `.eq("type", "expense")` — sin cambios.
- `getCategoryBreakdown`: ya filtra `.eq("type", "expense")` — sin cambios.
- `getBreakdownByAccount`: ya filtra `.in("type", ["expense", "income"])` — sin cambios.

- [ ] **Step 6: Verificar tipos**

Run: `cd apps/web && pnpm typecheck && pnpm test`
Expected: sin errores de tipos, 19 tests pasando.

- [ ] **Step 7: Verificar a mano**

Con `pnpm dev` corriendo:

1. Anotar el saldo de una cuenta y el "Gastos" del mes.
2. Cargar un gasto de $60.000 en 6 cuotas con fecha de hoy.
3. En Movimientos aparecen exactamente **6 filas** (`1/6` … `6/6`), no 7.
4. El saldo de la cuenta bajó **$10.000** (una cuota), no $60.000 ni $70.000.
5. El "Gastos" del mes subió $10.000.
6. Borrar la compra desde la cuota `1/6`: el error esperado es
   "No se pueden borrar cuotas individuales".
7. Verificar que el saldo vuelve al original borrando el padre vía SQL Editor:
   `delete from transactions where is_installment_parent = true;` — el saldo
   debe volver a subir exactamente $10.000.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/actions.ts apps/web/src/lib/queries.ts
git commit -m "Fix: la compra en cuotas se contaba dos veces

- El padre (monto total) se excluye de listas y agregados via is_installment_parent
- El saldo se ajusta por cuota vencida al crear y se revierte igual al borrar;
  antes restaba una cuota y devolvia el total, inflando el saldo
- splitInstallments reparte los centavos: 100 en 3 cuotas suma 100, no 99.99
- Las transferencias dejan de aparecer en tendencias y comparativa mensual"
```

---

## Task 5: Cotizaciones automáticas y totales convertidos

**Files:**
- Create: `supabase/functions/exchange-rates-cron/index.ts`
- Create: `supabase/migrations/0006_exchange_rates_cron.sql`
- Modify: `apps/web/src/lib/queries.ts` (`getRates`, `getTotalBalance`)
- Modify: `apps/web/src/lib/actions.ts` (`fetchRate`)
- Modify: `apps/web/src/app/dashboard/page.tsx`
- Modify: `docs/SETUP.md`

**Interfaces:**
- Consumes: `convert`, `sumInBase`, `type Rate` de Task 1.
- Produces: `getRates(): Promise<Rate[]>` en `queries.ts`; `getTotalBalance` pasa a la firma `(accounts, base, rates) => { total: number; partial: boolean }`.

- [ ] **Step 1: Escribir la Edge Function**

Crear `supabase/functions/exchange-rates-cron/index.ts`:

```ts
// Puebla public.exchange_rates con las cotizaciones del día.
// Invocada por pg_cron una vez por día (ver migración 0006).
import { createClient } from "jsr:@supabase/supabase-js@2";

const QUOTES = ["ARS", "EUR", "BRL", "MXN", "CLP", "COP", "PEN", "UYU"];

Deno.serve(async () => {
  const accessKey = Deno.env.get("EXCHANGERATE_ACCESS_KEY");
  if (!accessKey) {
    return new Response(JSON.stringify({ error: "falta EXCHANGERATE_ACCESS_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url =
    `https://api.exchangerate.host/live?access_key=${accessKey}` +
    `&source=USD&currencies=${QUOTES.join(",")}`;

  const res = await fetch(url);
  const payload = await res.json();

  if (!payload.success || !payload.quotes) {
    return new Response(JSON.stringify({ error: "respuesta invalida", payload }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // La API devuelve { "USDARS": 1234.5, "USDEUR": 0.9, ... }
  const date = new Date().toISOString().slice(0, 10);
  const rows = Object.entries(payload.quotes as Record<string, number>).map(([pair, rate]) => ({
    base: pair.slice(0, 3),
    quote: pair.slice(3),
    rate,
    date,
    source: "api",
  }));

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await supabase
    .from("exchange_rates")
    .upsert(rows, { onConflict: "base,quote,date" });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, inserted: rows.length, date }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Desplegar la función y cargar el secret**

Registrarse en https://exchangerate.host y obtener el `access_key` del plan
gratuito. Luego:

```bash
supabase secrets set EXCHANGERATE_ACCESS_KEY=<tu-access-key>
supabase functions deploy exchange-rates-cron
```

Probarla una vez a mano:

```bash
supabase functions invoke exchange-rates-cron
```

Expected: `{"ok":true,"inserted":8,"date":"2026-08-24"}`

- [ ] **Step 3: Guardar la service_role key en Vault**

En el SQL Editor de Supabase (esto **no** se commitea):

```sql
select vault.create_secret('<TU-SERVICE-ROLE-KEY>', 'service_role_key');
select vault.create_secret('https://<TU-PROJECT-REF>.supabase.co', 'project_url');
```

- [ ] **Step 4: Escribir la migración del cron**

Crear `supabase/migrations/0006_exchange_rates_cron.sql`:

```sql
-- ============================================================================
-- Guita — Migración 0006: cotizaciones diarias vía pg_cron
-- ============================================================================
-- Requiere que existan estos secrets en Vault (creados a mano, nunca en el repo):
--   select vault.create_secret('<service-role-key>', 'service_role_key');
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- Reprogramar es seguro: si el job ya existe se reemplaza.
select cron.unschedule('exchange-rates-daily')
 where exists (select 1 from cron.job where jobname = 'exchange-rates-daily');

-- 09:00 UTC = 06:00 en Argentina. El body se evalúa en cada corrida,
-- así que la key se lee de Vault al momento de ejecutar, no al programar.
select cron.schedule(
  'exchange-rates-daily',
  '0 9 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/exchange-rates-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 5: Aplicar la migración y verificar el job**

Pegar `0006_exchange_rates_cron.sql` en el SQL Editor y ejecutar. Luego:

```sql
select jobname, schedule, active from cron.job where jobname = 'exchange-rates-daily';
select base, quote, rate, date from public.exchange_rates order by date desc limit 10;
```

Expected: el job aparece con `active = true`, y hay al menos 8 filas de rates.

- [ ] **Step 6: Agregar `getRates` a `queries.ts`**

En `apps/web/src/lib/queries.ts`, agregar cerca del inicio (después de los imports):

```ts
import type { Rate } from "@/lib/money";
import { sumInBase } from "@/lib/money";

/** Cotizaciones más recientes disponibles, una por par base/quote. */
export async function getRates(): Promise<Rate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("base, quote, rate, date")
    .order("date", { ascending: false })
    .limit(200);
  if (error) throw error;

  const latest = new Map<string, Rate>();
  for (const r of data ?? []) {
    const key = `${r.base}:${r.quote}`;
    if (!latest.has(key)) latest.set(key, { base: r.base, quote: r.quote, rate: r.rate });
  }
  return [...latest.values()];
}
```

- [ ] **Step 7: Reemplazar `getTotalBalance`**

En `apps/web/src/lib/queries.ts`, reemplazar la función `getTotalBalance` por:

```ts
/**
 * Suma los saldos convirtiendo a la moneda base.
 * `partial: true` significa que faltó al menos un rate y el total está incompleto:
 * la UI debe decirlo en vez de mostrar un número que no significa nada.
 */
export function getTotalBalance(
  accounts: { balance: number; currency: string }[],
  baseCurrency: string,
  rates: Rate[],
): { total: number; partial: boolean } {
  return sumInBase(accounts, baseCurrency, rates);
}
```

- [ ] **Step 8: Actualizar el dashboard**

En `apps/web/src/app/dashboard/page.tsx`:

Agregar `getRates` al import de `@/lib/queries` y al `Promise.all`:

```ts
  const [accounts, transactions, summary, rates] = await Promise.all([
    getAccounts(),
    getTransactions({ limit: 5 }),
    getMonthlySummary(),
    getRates(),
  ]);
```

Reemplazar el cálculo de `totalBalance` por:

```ts
  const baseCurrency = profile.base_currency;
  const { total: totalBalance, partial } = getTotalBalance(
    accounts.map((a) => ({ balance: a.balance, currency: a.currency })),
    baseCurrency,
    rates,
  );
```

Borrar la línea `const baseCurrency = profile.base_currency;` que quedaba más abajo.

Dentro de la sección "Saldo total neto", agregar debajo del monto:

```tsx
        {partial && (
          <p className="mt-1 text-xs opacity-80">
            Faltan cotizaciones de algunas monedas: el total está incompleto.
          </p>
        )}
```

- [ ] **Step 9: Mejorar `fetchRate` en `actions.ts`**

En `apps/web/src/lib/actions.ts`, reemplazar `fetchRate` por:

```ts
/**
 * Busca la cotización vigente a la fecha de la transacción.
 * Si no hay ninguna, cae a 1 y lo deja registrado: un rate faltante
 * corrompe amount_base en silencio, así que al menos queda rastro.
 */
async function fetchRate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  from: string,
  to: string,
  onDate?: string,
): Promise<number> {
  if (from === to) return 1;

  let q = supabase
    .from("exchange_rates")
    .select("rate")
    .eq("base", from)
    .eq("quote", to)
    .order("date", { ascending: false })
    .limit(1);
  if (onDate) q = q.lte("date", onDate);

  const { data } = await q.maybeSingle();
  if (data?.rate) return data.rate;

  // Probar el par inverso antes de rendirse
  let inv = supabase
    .from("exchange_rates")
    .select("rate")
    .eq("base", to)
    .eq("quote", from)
    .order("date", { ascending: false })
    .limit(1);
  if (onDate) inv = inv.lte("date", onDate);

  const { data: inverse } = await inv.maybeSingle();
  if (inverse?.rate) return 1 / inverse.rate;

  console.warn(`[guita] sin cotización ${from}->${to} al ${onDate ?? "hoy"}; usando 1`);
  return 1;
}
```

Actualizar las tres llamadas existentes para pasar la fecha:
`await fetchRate(supabase, parsed.currency, baseCurrency, parsed.date)` en
`createTransaction` y `updateTransaction`, y
`await fetchRate(supabase, sub.currency, baseCurrency, sub.next_date)` en
`registerSubscriptionPayment`.

- [ ] **Step 10: Documentar el setup**

Agregar al final de `docs/SETUP.md`:

```markdown
## 8. Cotizaciones automáticas

1. Registrarse en [exchangerate.host](https://exchangerate.host) y copiar el `access_key`.
2. Cargar el secret y desplegar la función:
   ```bash
   supabase secrets set EXCHANGERATE_ACCESS_KEY=<tu-access-key>
   supabase functions deploy exchange-rates-cron
   supabase functions invoke exchange-rates-cron   # prueba
   ```
3. Guardar en Vault las credenciales que usa el cron (**no van al repo**):
   ```sql
   select vault.create_secret('<TU-SERVICE-ROLE-KEY>', 'service_role_key');
   select vault.create_secret('https://<TU-PROJECT-REF>.supabase.co', 'project_url');
   ```
4. Ejecutar `supabase/migrations/0006_exchange_rates_cron.sql`.
5. Verificar: `select * from cron.job where jobname = 'exchange-rates-daily';`

Sin este paso los totales multi-moneda del dashboard aparecen marcados como
incompletos, que es el comportamiento correcto: no inventan un número.
```

- [ ] **Step 11: Verificar tipos y a mano**

Run: `cd apps/web && pnpm typecheck && pnpm test`
Expected: sin errores, 19 tests pasando.

Con la app corriendo y una cuenta en ARS y otra en USD: el "Patrimonio neto"
debe mostrar la suma convertida. Para probar el caso incompleto, borrar los rates
(`delete from exchange_rates;`) y recargar: aparece el aviso de total incompleto.
Volver a poblarlos con `supabase functions invoke exchange-rates-cron`.

- [ ] **Step 12: Commit**

```bash
git add supabase/functions/exchange-rates-cron/index.ts supabase/migrations/0006_exchange_rates_cron.sql apps/web/src/lib/queries.ts apps/web/src/lib/actions.ts apps/web/src/app/dashboard/page.tsx docs/SETUP.md
git commit -m "Feat: cotizaciones diarias automaticas y patrimonio neto convertido

- Edge Function exchange-rates-cron: exchangerate.host -> exchange_rates
- pg_cron diario a las 09:00 UTC, con credenciales leidas de Vault
- getTotalBalance convierte a moneda base en vez de sumar ARS + USD en crudo
- El dashboard avisa cuando falta una cotizacion en vez de mostrar un total falso
- fetchRate busca por fecha y prueba el par inverso antes de caer a 1"
```

---

## Task 6: Aportes a metas que mueven plata real

**Files:**
- Modify: `apps/web/src/lib/schemas.ts` (`contributionFormSchema`)
- Modify: `apps/web/src/lib/actions.ts` (`contributeToGoal`)
- Modify: `apps/web/src/lib/queries.ts` (`getMonthlySummary`)
- Modify: `apps/web/src/app/dashboard/metas/page.tsx`
- Modify: `apps/web/src/app/dashboard/metas/goal-list.tsx`

**Interfaces:**
- Consumes: `applyBalance` de Task 3, `todayLocal` de Task 1.
- Produces: `getMonthlySummary` devuelve un campo adicional `savings: number`.

- [ ] **Step 1: Exigir cuenta en el schema del aporte**

En `apps/web/src/lib/schemas.ts`, reemplazar `contributionFormSchema` por:

```ts
export const contributionFormSchema = z.object({
  amount: z.number().positive("El aporte tiene que ser positivo"),
  account_id: z.string().uuid("Elegí de qué cuenta sale"),
  note: z.string().max(200).optional(),
});
```

- [ ] **Step 2: Reescribir `contributeToGoal`**

En `apps/web/src/lib/actions.ts`, reemplazar la función completa por:

```ts
export async function contributeToGoal(goalId: string, formData: FormData) {
  const parsed = contributionFormSchema.parse({
    amount: Number(formData.get("amount")),
    account_id: formData.get("account_id"),
    note: formData.get("note") || undefined,
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: goal } = await supabase
    .from("goals")
    .select("current_amount, target_amount, currency, name")
    .eq("id", goalId)
    .single();
  if (!goal) throw new Error("Meta no encontrada");

  const { data: profile } = await supabase
    .from("users")
    .select("base_currency")
    .eq("id", user.id)
    .single();
  const baseCurrency = profile?.base_currency ?? "ARS";
  const date = todayLocal();
  const rate = await fetchRate(supabase, goal.currency, baseCurrency, date);

  // El aporte sale de una cuenta real y deja rastro como transacción.
  // goal_id la marca como ahorro: no se cuenta como gasto del mes.
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      type: "expense",
      amount: parsed.amount,
      currency: goal.currency,
      amount_base: parsed.amount * rate,
      exchange_rate: rate,
      account_id: parsed.account_id,
      goal_id: goalId,
      note: parsed.note ? `Meta ${goal.name}: ${parsed.note}` : `Aporte a meta: ${goal.name}`,
      date,
      source: "manual",
    })
    .select()
    .single();
  if (txErr) throw txErr;

  const { error: contribErr } = await supabase.from("goal_contributions").insert({
    goal_id: goalId,
    user_id: user.id,
    amount: parsed.amount,
    transaction_id: tx.id,
    note: parsed.note,
  });
  if (contribErr) throw contribErr;

  await applyBalance(supabase, parsed.account_id, -parsed.amount);

  // Completar una meta no la archiva: archivar es una decisión del usuario.
  await supabase
    .from("goals")
    .update({ current_amount: goal.current_amount + parsed.amount })
    .eq("id", goalId);

  revalidatePath("/dashboard/metas");
  revalidatePath("/dashboard");
}
```

- [ ] **Step 3: Separar el ahorro del gasto en el resumen mensual**

En `apps/web/src/lib/queries.ts`, en `getMonthlySummary`, reemplazar la query y el
bucle por:

```ts
  const { data, error } = await supabase
    .from("transactions")
    .select("type, amount, amount_base, goal_id")
    .in("type", ["income", "expense"])
    .eq("is_installment_parent", false)
    .gte("date", from);

  if (error) throw error;

  const summary = { income: 0, expense: 0, savings: 0, incomeBase: 0, expenseBase: 0 };
  for (const t of data ?? []) {
    if (t.type === "income") {
      summary.income += t.amount;
      summary.incomeBase += t.amount_base;
    } else if (t.goal_id) {
      // Aporte a una meta: salió de la cuenta, pero no se consumió.
      summary.savings += t.amount;
    } else {
      summary.expense += t.amount;
      summary.expenseBase += t.amount_base;
    }
  }
```

- [ ] **Step 4: Excluir los aportes del desglose por categoría**

En `apps/web/src/lib/queries.ts`, en `getCategoryBreakdown`, agregar
`.is("goal_id", null)` a la cadena. La función ya salta las transacciones sin
categoría, así que esto es defensa en profundidad y documenta la intención:

```ts
  let q = supabase
    .from("transactions")
    .select("amount, amount_base, currency, category:categories(id, name, color, icon)")
    .eq("type", "expense")
    .eq("is_installment_parent", false)
    .is("goal_id", null);
```

- [ ] **Step 5: Pasar las cuentas a la pantalla de metas**

En `apps/web/src/app/dashboard/metas/page.tsx`, agregar `getAccounts` al import de
`@/lib/queries` y cargar las cuentas:

```ts
  const [goals, accounts] = await Promise.all([getGoals(), getAccounts()]);
```

Y pasarlas al componente:

```tsx
      <GoalList
        goals={goals}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))}
        baseCurrency={profile.base_currency}
      />
```

- [ ] **Step 6: Agregar el selector de cuenta al formulario de aporte**

En `apps/web/src/app/dashboard/metas/goal-list.tsx`:

Agregar el tipo y el prop:

```ts
type Account = { id: string; name: string; currency: string };
```

```ts
export function GoalList({
  goals,
  accounts,
  baseCurrency,
}: {
  goals: Goal[];
  accounts: Account[];
  baseCurrency: string;
}) {
```

Reemplazar el formulario de aporte rápido por:

```tsx
              <form
                onSubmit={(e) => handleContribute(g.id, e)}
                className="flex flex-col gap-2"
              >
                <select
                  name="account_id"
                  required
                  defaultValue={accounts[0]?.id ?? ""}
                  aria-label="Cuenta de la que sale el aporte"
                  className="h-10 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="">¿De qué cuenta sale?</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.currency}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    required
                    placeholder="Monto del aporte"
                    aria-label="Monto del aporte"
                    className="h-10 flex-1 rounded-xl border border-input bg-background px-3 font-mono text-sm tabular-nums outline-none focus:border-primary"
                  />
                  <button
                    type="submit"
                    disabled={pending || accounts.length === 0}
                    className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                  >
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aportar"}
                  </button>
                </div>
              </form>
```

Cambiar la condición que envuelve el formulario, para que una meta completada
siga aceptando aportes hasta que se archive:

```tsx
            {!g.archived && (
```

Y reemplazar el cartel de meta completada por uno que no implique que terminó:

```tsx
            {g.isCompleted && !g.archived && (
              <p className="rounded-lg bg-primary/10 px-3 py-2 text-center text-sm font-medium text-primary">
                ¡Meta completada! 🎉 Archivala cuando quieras.
              </p>
            )}
```

- [ ] **Step 7: Mostrar el ahorro en el dashboard**

En `apps/web/src/app/dashboard/page.tsx`, en la card "Ahorro" del resumen del mes,
reemplazar el cálculo por el valor real:

```tsx
            <p className="mt-1.5 font-mono text-lg font-semibold tabular-nums">
              {formatMoney(summary.income - summary.expense, baseCurrency)}
            </p>
            {summary.savings > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatMoney(summary.savings, baseCurrency)} a metas
              </p>
            )}
```

- [ ] **Step 8: Verificar tipos**

Run: `cd apps/web && pnpm typecheck && pnpm lint`
Expected: sin errores.

- [ ] **Step 9: Verificar a mano**

1. Anotar el saldo de una cuenta y el "Gastos" del mes.
2. Ir a Metas, expandir una meta, elegir la cuenta y aportar $5.000.
3. El saldo de la cuenta bajó $5.000.
4. El "Gastos" del mes **no** cambió; la card "Ahorro" muestra "$5.000 a metas".
5. En Movimientos aparece "Aporte a meta: <nombre>".
6. Completar la meta con un aporte grande: sigue en "Activas" con el cartel de
   completada, no salta a "Archivadas".

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/lib/schemas.ts apps/web/src/lib/actions.ts apps/web/src/lib/queries.ts apps/web/src/app/dashboard/metas/page.tsx apps/web/src/app/dashboard/metas/goal-list.tsx apps/web/src/app/dashboard/page.tsx
git commit -m "Feat: los aportes a metas descuentan de una cuenta real

- El aporte crea una transaccion con goal_id y usa goal_contributions.transaction_id
  (columna que existia sin usar desde la migracion 0003)
- El formulario ahora exige de que cuenta sale
- Los aportes se agrupan como ahorro, no como gasto del mes
- Completar una meta ya no la archiva automaticamente: se elegia sola y desaparecia"
```

---

## Task 7: Suscripciones idempotentes

**Files:**
- Modify: `apps/web/src/lib/actions.ts` (`registerSubscriptionPayment`)
- Modify: `apps/web/src/app/dashboard/suscripciones/subscription-list.tsx`

**Interfaces:**
- Consumes: `addCadenceIso` de Task 1, `applyBalance` de Task 3, el índice `uq_subscription_payment_per_day` de Task 2.

- [ ] **Step 1: Reescribir `registerSubscriptionPayment`**

En `apps/web/src/lib/actions.ts`, reemplazar la función completa por:

```ts
export async function registerSubscriptionPayment(subscriptionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: sub, error: subErr } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .single();
  if (subErr || !sub) throw new Error("Suscripción no encontrada");

  if (!sub.account_id) {
    throw new Error("Asignale una cuenta a la suscripción antes de registrar el pago");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("base_currency")
    .eq("id", user.id)
    .single();
  const baseCurrency = profile?.base_currency ?? "ARS";

  // El pago se fecha el día que vencía, no hoy: si registrás con atraso,
  // el gasto cae en el mes que corresponde.
  const paymentDate = sub.next_date;
  const rate = await fetchRate(supabase, sub.currency, baseCurrency, paymentDate);

  const { error: txErr } = await supabase.from("transactions").insert({
    user_id: user.id,
    type: "expense",
    amount: sub.amount,
    currency: sub.currency,
    amount_base: sub.amount * rate,
    exchange_rate: rate,
    category_id: sub.category_id,
    account_id: sub.account_id,
    note: `Suscripción: ${sub.name}`,
    date: paymentDate,
    source: "manual",
    subscription_id: subscriptionId,
  });

  if (txErr) {
    // uq_subscription_payment_per_day: la base rechaza el pago duplicado.
    if (txErr.code === "23505") {
      throw new Error("Ese pago ya estaba registrado");
    }
    throw txErr;
  }

  await applyBalance(supabase, sub.account_id, -sub.amount);

  await supabase
    .from("subscriptions")
    .update({ next_date: addCadenceIso(sub.next_date, sub.cadence) })
    .eq("id", subscriptionId);

  revalidatePath("/dashboard/suscripciones");
  revalidatePath("/dashboard");
}
```

- [ ] **Step 2: Borrar el `switch` de cadencia que quedó sin uso**

En `apps/web/src/lib/actions.ts`, confirmar que el bloque
`const nextDate = new Date(sub.next_date + "T00:00:00"); switch (sub.cadence) { ... }`
ya no existe. Lo reemplazó `addCadenceIso`.

- [ ] **Step 3: Deshabilitar el botón cuando falta la cuenta**

En `apps/web/src/app/dashboard/suscripciones/subscription-list.tsx`, reemplazar el
botón "Registrar pago" por:

```tsx
          {s.active && (
            <button
              onClick={() => handlePayment(s.id)}
              disabled={pending || !s.account_id}
              title={!s.account_id ? "Asignale una cuenta primero" : undefined}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Registrar pago
            </button>
          )}
          {s.active && !s.account_id && (
            <span className="self-center text-xs text-muted-foreground">
              Sin cuenta asignada
            </span>
          )}
```

- [ ] **Step 4: Verificar tipos**

Run: `cd apps/web && pnpm typecheck && pnpm lint`
Expected: sin errores.

- [ ] **Step 5: Verificar a mano**

1. Crear una suscripción **sin** cuenta: el botón "Registrar pago" está
   deshabilitado y dice "Sin cuenta asignada".
2. Editarla para asignarle una cuenta: el botón se habilita.
3. Tocar "Registrar pago": se crea un gasto y `next_date` avanza un período.
4. Tocar "Registrar pago" **de nuevo** inmediatamente: se registra normalmente,
   porque la nueva fecha es distinta. Para probar el duplicado, volver
   `next_date` a la fecha anterior desde el formulario de edición y registrar:
   debe aparecer "Ese pago ya estaba registrado".
5. Expandir el historial: los pagos aparecen con la fecha de vencimiento.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/actions.ts apps/web/src/app/dashboard/suscripciones/subscription-list.tsx
git commit -m "Fix: pagos de suscripcion idempotentes y con cuenta obligatoria

- El indice unico (subscription_id, date) rechaza el pago duplicado en la base
- Sin account_id el pago se rechaza con mensaje accionable; antes insertaba
  la transaccion con cuenta nula y ningun saldo se movia
- El pago se fecha en next_date, no en hoy: registrar con atraso imputa al mes correcto
- addCadenceIso reemplaza el switch de fechas con aritmetica UTC"
```

---

## Task 8: Navegación completa en mobile

**Files:**
- Create: `apps/web/src/components/more-sheet.tsx`
- Modify: `apps/web/src/components/bottom-nav.tsx`
- Delete: `apps/web/src/components/fab.tsx`

**Interfaces:**
- Produces: `<MoreSheet open onClose />`.

- [ ] **Step 1: Crear la hoja "Más"**

Crear `apps/web/src/components/more-sheet.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Target, RefreshCw, Landmark, Tags, Settings, X, type LucideIcon } from "lucide-react";

const MORE_ITEMS: { href: string; icon: LucideIcon; label: string }[] = [
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
        <nav className="flex flex-col p-3">
          {MORE_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-xl px-3 py-3.5 text-sm font-medium transition ${isActive ? "bg-primary/10 text-primary" : "hover:bg-accent"}`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Reemplazar "Ajustes" por "Más" en el bottom nav**

En `apps/web/src/components/bottom-nav.tsx`:

Reemplazar los imports de iconos y agregar el de la hoja:

```tsx
import { Home, Wallet, PieChart, TrendingUp, MoreHorizontal, Plus } from "lucide-react";
import { MoreSheet } from "@/components/more-sheet";
```

Reemplazar la constante `TABS` por:

```tsx
const TABS = [
  { href: "/dashboard", icon: Home, label: "Inicio", exact: true },
  { href: "/dashboard/gastos", icon: Wallet, label: "Gastos" },
  { href: "/dashboard/presupuestos", icon: PieChart, label: "Presup." },
  { href: "/dashboard/reportes", icon: TrendingUp, label: "Reportes" },
];

// Rutas que viven detrás del botón "Más": el tab se marca activo si estás en una.
const MORE_ROUTES = [
  "/dashboard/metas",
  "/dashboard/suscripciones",
  "/dashboard/cuentas",
  "/dashboard/categorias",
  "/dashboard/ajustes",
];
```

Agregar el estado de la hoja junto al que ya existe:

```tsx
  const [moreOpen, setMoreOpen] = useState(false);
```

Dentro del `<nav>`, después del `.map` de `TABS`, agregar el botón "Más":

```tsx
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[10px] font-medium transition ${MORE_ROUTES.some((r) => pathname.startsWith(r)) ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            aria-label="Más secciones"
          >
            <MoreHorizontal className="h-5 w-5" />
            Más
          </button>
```

Y antes del `<TransactionSheet>` del final, agregar:

```tsx
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
```

- [ ] **Step 3: Borrar el FAB muerto**

`apps/web/src/components/fab.tsx` no lo importa nadie: el `BottomNav` tiene su
propio botón `+` idéntico.

```bash
git rm apps/web/src/components/fab.tsx
```

- [ ] **Step 4: Verificar que nada lo importaba**

Run: `cd apps/web && grep -rn "components/fab" src || echo "sin referencias"`
Expected: `sin referencias`

Run: `cd apps/web && pnpm typecheck && pnpm lint`
Expected: sin errores.

- [ ] **Step 5: Verificar a mano en viewport mobile**

Con `pnpm dev`, abrir las DevTools en modo dispositivo (375×812):

1. El bottom nav muestra Inicio, Gastos, Presup., Reportes, Más.
2. Tocar "Más" abre la hoja con los cinco destinos.
3. Cada uno navega y cierra la hoja.
4. Estando en Metas, el tab "Más" queda resaltado en esmeralda.
5. Tocar el fondo oscuro cierra la hoja.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/more-sheet.tsx apps/web/src/components/bottom-nav.tsx
git commit -m "Fix: Metas, Suscripciones, Cuentas y Categorias eran inalcanzables en mobile

- Nuevo boton Mas en el bottom nav que abre una hoja con los 5 destinos restantes
- El sidebar desktop tenia 9 destinos y el bottom nav 5, sin solapamiento
- Borrado fab.tsx: duplicaba el boton + del bottom nav y no lo importaba nadie"
```

---

## Task 9: Reportes con período seleccionable

**Files:**
- Create: `apps/web/src/app/dashboard/reportes/period-picker.tsx`
- Modify: `apps/web/src/app/dashboard/reportes/page.tsx`
- Modify: `apps/web/src/app/dashboard/reportes/pareto-bar-chart.tsx`
- Modify: `apps/web/src/app/dashboard/reportes/category-pie-chart.tsx`
- Modify: `apps/web/src/app/dashboard/reportes/trends-line-chart.tsx`
- Modify: `apps/web/src/app/dashboard/reportes/account-bar-chart.tsx`

**Interfaces:**
- Consumes: `monthStartLocal`, `monthEndLocal`, `addMonthsIso`, `todayLocal` de Task 1.
- Produces: `resolvePeriod(key: string): { from?: string; to?: string; label: string }` exportada desde `period-picker.tsx`.

- [ ] **Step 1: Crear el selector de período**

Crear `apps/web/src/app/dashboard/reportes/period-picker.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { monthStartLocal, monthEndLocal, addMonthsIso, todayLocal } from "@/lib/dates";

export const PERIODS = [
  { key: "mes", label: "Este mes" },
  { key: "anterior", label: "Mes anterior" },
  { key: "trimestre", label: "3 meses" },
  { key: "todo", label: "Todo" },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];

/** Traduce la clave de período a un rango de fechas. Server-safe. */
export function resolvePeriod(key: string | undefined): {
  from?: string;
  to?: string;
  label: string;
} {
  const now = new Date();
  switch (key) {
    case "anterior": {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { from: monthStartLocal(prev), to: monthEndLocal(prev), label: "Mes anterior" };
    }
    case "trimestre":
      return {
        from: addMonthsIso(monthStartLocal(now), -2),
        to: todayLocal(now),
        label: "Últimos 3 meses",
      };
    case "todo":
      return { label: "Histórico completo" };
    default:
      return { from: monthStartLocal(now), to: monthEndLocal(now), label: "Este mes" };
  }
}

export function PeriodPicker() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("periodo") ?? "mes";

  function select(key: string) {
    const next = new URLSearchParams(params.toString());
    if (key === "mes") next.delete("periodo");
    else next.set("periodo", key);
    const qs = next.toString();
    router.push(qs ? `/dashboard/reportes?${qs}` : "/dashboard/reportes");
  }

  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          onClick={() => select(p.key)}
          className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${current === p.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Pasar el período a las queries**

En `apps/web/src/app/dashboard/reportes/page.tsx`:

Agregar los imports:

```tsx
import { Suspense } from "react";
import { PeriodPicker, resolvePeriod } from "./period-picker";
```

Cambiar la firma y el cuerpo inicial:

```tsx
export default async function ReportesPage({ searchParams }: PageProps<"/dashboard/reportes">) {
  const sp = await searchParams;
  const { profile } = await getCurrentUser();
  const baseCurrency = profile.base_currency;

  const periodo = typeof sp.periodo === "string" ? sp.periodo : undefined;
  const { from, to, label } = resolvePeriod(periodo);

  const [categories, trends, comparison, byAccount] = await Promise.all([
    getCategoryBreakdown({ from, to }),
    getMonthlyTrends(),
    getMonthComparison(),
    getBreakdownByAccount({ from, to }),
  ]);
```

- [ ] **Step 3: Renderizar el selector y el período activo**

En el mismo archivo, reemplazar el `<header>` por:

```tsx
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-semibold lg:text-2xl">Reportes</h1>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
        <Suspense fallback={<div className="h-11 rounded-xl bg-muted" />}>
          <PeriodPicker />
        </Suspense>
      </header>
```

`PeriodPicker` usa `useSearchParams`, así que necesita el `Suspense` para que la
página no se fuerce a renderizado dinámico completo.

Agregar el período como subtítulo de las dos secciones filtradas. Reemplazar sus
encabezados por:

```tsx
        <h2 className="text-lg font-semibold">
          Desglose por categoría{" "}
          <span className="text-sm font-normal text-muted-foreground">· {label}</span>
        </h2>
```

```tsx
        <h2 className="text-lg font-semibold">
          Top gastos (Pareto){" "}
          <span className="text-sm font-normal text-muted-foreground">· {label}</span>
        </h2>
```

```tsx
        <h2 className="text-lg font-semibold">
          Por cuenta / método de pago{" "}
          <span className="text-sm font-normal text-muted-foreground">· {label}</span>
        </h2>
```

La sección "Tendencias (6 meses)" y la comparativa mes a mes **no** se filtran:
tienen su propio período por definición. Agregar una aclaración a la comparativa:

```tsx
        <h2 className="text-lg font-semibold">Este mes vs mes anterior</h2>
```

se mantiene igual, pero justo debajo del `</h2>` agregar:

```tsx
        <p className="-mt-2 text-xs text-muted-foreground">
          Siempre compara mes calendario, sin importar el período elegido arriba.
        </p>
```

- [ ] **Step 4: Arreglar los tooltips de Recharts en tema oscuro**

En los cuatro archivos de gráfico (`pareto-bar-chart.tsx`,
`category-pie-chart.tsx`, `trends-line-chart.tsx`, `account-bar-chart.tsx`),
reemplazar cada `contentStyle` del `<Tooltip>` por:

```tsx
          contentStyle={{
            borderRadius: 12,
            border: "1px solid var(--border)",
            backgroundColor: "var(--card)",
            color: "var(--card-foreground)",
            fontSize: 12,
          }}
          itemStyle={{ color: "var(--card-foreground)" }}
          labelStyle={{ color: "var(--muted-foreground)" }}
```

Sin `backgroundColor` explícito Recharts pinta blanco fijo, y en tema oscuro el
texto queda blanco sobre blanco.

- [ ] **Step 5: Corregir el texto ilegible del detalle de cuenta**

En `apps/web/src/app/dashboard/cuentas/[id]/page.tsx`, reemplazar la línea del
cambio mensual por:

```tsx
        <p className="mt-2 text-sm text-primary-foreground/80">
          {monthChange >= 0 ? "↑" : "↓"} {formatMoney(Math.abs(monthChange), account.currency)} este mes
        </p>
```

`text-white/70` era un color fijo; en tema oscuro `--primary-foreground` es casi
negro, así que el blanco sobre esmeralda claro quedaba ilegible.

- [ ] **Step 6: Verificar tipos**

Run: `cd apps/web && pnpm typecheck && pnpm lint`
Expected: sin errores.

- [ ] **Step 7: Verificar a mano**

1. Abrir Reportes: arranca en "Este mes" y el subtítulo lo dice.
2. Tocar "3 meses": la URL pasa a `/dashboard/reportes?periodo=trimestre` y los
   montos de la torta cambian.
3. Recargar con esa URL: el período se mantiene seleccionado.
4. Tocar "Este mes": la URL vuelve a `/dashboard/reportes` sin query.
5. Cambiar a tema oscuro y pasar el mouse por un gráfico: el tooltip es legible.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/dashboard/reportes/ "apps/web/src/app/dashboard/cuentas/[id]/page.tsx"
git commit -m "Feat: reportes con selector de periodo y tooltips legibles en dark

- getCategoryBreakdown y getBreakdownByAccount aceptaban from/to y la pagina
  nunca se los pasaba: todos los graficos mezclaban el historico completo
- El periodo viaja por searchParams: la URL es compartible y recargable
- Los tooltips de Recharts fijan backgroundColor: en dark eran blanco sobre blanco
- El detalle de cuenta usa primary-foreground en vez de text-white/70 fijo"
```

---

## Task 10: Ajustes editables y selector de tema

**Files:**
- Create: `apps/web/src/components/theme-toggle.tsx`
- Create: `apps/web/src/app/dashboard/ajustes/settings-form.tsx`
- Modify: `apps/web/src/lib/schemas.ts`
- Modify: `apps/web/src/lib/actions.ts`
- Modify: `apps/web/src/app/dashboard/ajustes/page.tsx`
- Modify: `apps/web/src/components/theme-init.tsx`

**Interfaces:**
- Produces: `updateProfile(formData: FormData)` en `actions.ts`; `profileFormSchema` en `schemas.ts`.

- [ ] **Step 1: Agregar el schema del perfil**

En `apps/web/src/lib/schemas.ts`, al final:

```ts
// ----------------------------------------------------------------------------
// Perfil
// ----------------------------------------------------------------------------
export const profileFormSchema = z.object({
  full_name: z.string().min(1, "Poné tu nombre").max(80),
  base_currency: z.string().min(3).max(3),
});

export type ProfileForm = z.infer<typeof profileFormSchema>;
```

- [ ] **Step 2: Agregar el server action**

En `apps/web/src/lib/actions.ts`, agregar `profileFormSchema` al import de
`@/lib/schemas` y la función al final, antes de los helpers:

```ts
// ----------------------------------------------------------------------------
// Perfil
// ----------------------------------------------------------------------------
export async function updateProfile(formData: FormData) {
  const parsed = profileFormSchema.parse({
    full_name: formData.get("full_name"),
    base_currency: formData.get("base_currency"),
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("users").update(parsed).eq("id", user.id);
  if (error) throw error;

  // La moneda base afecta todos los totales, no solo Ajustes.
  revalidatePath("/dashboard", "layout");
}
```

- [ ] **Step 3: Crear el selector de tema**

Crear `apps/web/src/components/theme-toggle.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

const OPTIONS = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
  { value: "auto", label: "Automático", Icon: Monitor },
] as const;

type Theme = (typeof OPTIONS)[number]["value"];

export function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("auto");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("guita-theme") as Theme | null;
      if (stored === "light" || stored === "dark" || stored === "auto") setTheme(stored);
    } catch {
      // localStorage puede fallar en modo privado: el default "auto" alcanza.
    }
  }, []);

  function select(next: Theme) {
    setTheme(next);
    try {
      localStorage.setItem("guita-theme", next);
    } catch {
      // Si no se puede persistir, al menos aplicamos el tema en esta sesión.
    }
    applyTheme(next);
  }

  return (
    <div className="flex gap-1 rounded-xl bg-muted p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => select(o.value)}
          aria-pressed={theme === o.value}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${theme === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
        >
          <o.Icon className="h-4 w-4" />
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Hacer que `theme-init` entienda las tres opciones**

Reemplazar `apps/web/src/components/theme-init.tsx` por:

```tsx
"use client";

import { useEffect } from "react";

export function ThemeInit() {
  useEffect(() => {
    try {
      const pref = localStorage.getItem("guita-theme");
      const dark =
        pref === "dark" ||
        (pref !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
    } catch {
      // Sin localStorage se queda en tema claro; no vale romper el render por esto.
    }
  }, []);

  return null;
}
```

El cambio importante: `pref === "light"` ahora fuerza tema claro aunque el sistema
esté en oscuro. Antes cualquier valor distinto de `"dark"` caía en la preferencia
del sistema.

- [ ] **Step 5: Crear el formulario de ajustes**

Crear `apps/web/src/app/dashboard/ajustes/settings-form.tsx`:

```tsx
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
```

- [ ] **Step 6: Rearmar la pantalla de Ajustes**

Reemplazar `apps/web/src/app/dashboard/ajustes/page.tsx` por:

```tsx
import { getCurrentUser } from "@/lib/dal";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "./logout-button";
import { SettingsForm } from "./settings-form";

export default async function AjustesPage() {
  const { profile } = await getCurrentUser();

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold lg:text-2xl">Ajustes</h1>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Perfil</h2>
        <SettingsForm fullName={profile.full_name} baseCurrency={profile.base_currency} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Apariencia</h2>
        <ThemeToggle />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Cuenta</h2>
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
          <span className="text-sm text-muted-foreground">Email</span>
          <span className="text-sm font-medium">{profile.email}</span>
        </div>
      </section>

      <LogoutButton />
    </div>
  );
}
```

- [ ] **Step 7: Verificar tipos**

Run: `cd apps/web && pnpm typecheck && pnpm lint`
Expected: sin errores.

- [ ] **Step 8: Verificar a mano**

1. Ir a Ajustes, cambiar el nombre y guardar: aparece "Guardado" y el saludo del
   dashboard cambia.
2. Cambiar la moneda base a USD: aparece la advertencia; guardar y verificar que
   el patrimonio neto ahora se rotula en USD.
3. Tocar "Oscuro": la app cambia al instante.
4. Recargar: sigue en oscuro.
5. Tocar "Automático" con el SO en claro: vuelve a claro.
6. Tocar "Claro" con el SO en oscuro: se queda en claro (esto fallaba antes).

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/theme-toggle.tsx apps/web/src/components/theme-init.tsx apps/web/src/app/dashboard/ajustes/ apps/web/src/lib/schemas.ts apps/web/src/lib/actions.ts
git commit -m "Feat: ajustes editables y selector de tema

- Editar nombre y moneda base, con aviso de que no reconvierte lo historico
- Toggle Claro/Oscuro/Automatico que persiste en guita-theme
- theme-init.tsx leia esa clave desde el primer dia y nadie la escribia nunca:
  el modo oscuro de DESIGN.md era inalcanzable
- 'Claro' ahora fuerza tema claro aunque el sistema este en oscuro"
```

---

## Task 11: Estados de carga y error

**Files:**
- Create: `apps/web/src/app/dashboard/loading.tsx`
- Create: `apps/web/src/app/dashboard/error.tsx`
- Create: `apps/web/src/app/dashboard/reportes/loading.tsx`
- Create: `apps/web/src/app/dashboard/cuentas/[id]/not-found.tsx`

- [ ] **Step 1: Crear el esqueleto del dashboard**

Crear `apps/web/src/app/dashboard/loading.tsx`:

```tsx
/** Esqueleto genérico del dashboard: respeta la forma de las cards reales. */
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-4 w-24 rounded-full bg-muted" />
        <div className="h-6 w-48 rounded-full bg-muted" />
      </div>

      <div className="h-32 rounded-3xl bg-muted" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-muted" />
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear el esqueleto de reportes**

Reportes es la pantalla más lenta (cuatro agregaciones en paralelo, una de ellas
con seis queries), así que tiene su propio esqueleto con forma de gráficos.

Crear `apps/web/src/app/dashboard/reportes/loading.tsx`:

```tsx
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="h-6 w-32 rounded-full bg-muted" />
        <div className="h-11 rounded-xl bg-muted" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-muted" />
        ))}
      </div>

      <div className="h-64 rounded-2xl bg-muted" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-2xl bg-muted" />
        <div className="h-64 rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Crear la pantalla de error**

Crear `apps/web/src/app/dashboard/error.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[guita] error en el dashboard:", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Algo salió mal</h2>
        <p className="max-w-xs text-sm text-muted-foreground">
          No pudimos cargar esta pantalla. Probá de nuevo; si sigue fallando,
          cerrá sesión y volvé a entrar.
        </p>
      </div>
      <button
        onClick={reset}
        className="flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90 active:scale-[0.98]"
      >
        <RotateCw className="h-4 w-4" />
        Reintentar
      </button>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">ref: {error.digest}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Crear el not-found de cuentas**

Crear `apps/web/src/app/dashboard/cuentas/[id]/not-found.tsx`:

```tsx
import Link from "next/link";
import { Landmark } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Landmark className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">No encontramos esa cuenta</h2>
        <p className="text-sm text-muted-foreground">
          Puede que la hayas borrado desde otro dispositivo.
        </p>
      </div>
      <Link
        href="/dashboard/cuentas"
        className="flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
      >
        Ver mis cuentas
      </Link>
    </div>
  );
}
```

- [ ] **Step 5: Verificar tipos y lint**

Run: `cd apps/web && pnpm typecheck && pnpm lint`
Expected: sin errores.

- [ ] **Step 6: Verificar a mano**

1. Con la app corriendo, navegar entre Inicio y Reportes: aparecen los esqueletos
   pulsando, no la pantalla anterior congelada.
2. Abrir `/dashboard/cuentas/00000000-0000-0000-0000-000000000000`: aparece la
   pantalla "No encontramos esa cuenta".
3. Para probar `error.tsx`, agregar temporalmente `throw new Error("prueba")` al
   inicio de `getBudgets` en `queries.ts`, abrir Presupuestos, verificar la
   pantalla de error y el botón Reintentar, y **quitar el throw**.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/loading.tsx apps/web/src/app/dashboard/error.tsx apps/web/src/app/dashboard/reportes/loading.tsx "apps/web/src/app/dashboard/cuentas/[id]/not-found.tsx"
git commit -m "Feat: estados de carga y error en el dashboard

- loading.tsx con esqueletos que respetan la forma del contenido real
- Reportes tiene el suyo: es la pantalla mas lenta y no mostraba nada
- error.tsx con copy en español y boton de reintento
- not-found.tsx para cuentas inexistentes
La app no tenia ninguno de los tres: cada navegacion congelaba la pantalla anterior"
```

---

## Task 12: Limpieza final y verificación completa

**Files:**
- Delete: `apps/web/src/components/modal.tsx`
- Modify: `docs/PLAN.md`

- [ ] **Step 1: Borrar el modal sin usar**

`apps/web/src/components/modal.tsx` está sin trackear y no lo importa nadie; su
chrome ya vive dentro de `transaction-sheet.tsx` y `more-sheet.tsx`.

Run: `cd apps/web && grep -rn "components/modal" src || echo "sin referencias"`
Expected: `sin referencias`

```bash
rm apps/web/src/components/modal.tsx
```

- [ ] **Step 2: Marcar en el PLAN lo que quedó cerrado**

En `docs/PLAN.md`, agregar al final de la sección "Fase 4 — Reportes":

```markdown
- [x] Filtros globales de rango (selector de período, 2026-08-24).

> **Nota (2026-08-24):** las Fases 2–4 quedaron con defectos de integridad que se
> corrigieron por separado. Ver [SPEC-FIXES.md](SPEC-FIXES.md) y el plan
> `superpowers/plans/2026-08-24-fixes-datos-y-ux.md`.
```

- [ ] **Step 3: Correr la verificación completa**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: los cuatro comandos terminan con exit 0. `pnpm test` reporta 19 tests
pasando.

- [ ] **Step 4: Recorrer los criterios de aceptación del spec**

Con `pnpm dev` corriendo, verificar uno por uno los 13 criterios de la sección 5
de [SPEC-FIXES.md](../../SPEC-FIXES.md). Anotar cualquiera que falle antes de
commitear.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Chore: limpieza final y notas en el PLAN

- Borrado modal.tsx: nunca se importo, su chrome vive en transaction-sheet
- PLAN.md apunta al spec de correcciones"
```

---

## Self-Review

**Cobertura del spec:**

| Requisito del spec | Tarea |
|---|---|
| D1 transferencias como ingreso/gasto | 3 |
| D2 contrapartida por heurística | 3 |
| D3 padre de cuotas duplicado | 2, 4 |
| D4 saldo inflado al borrar cuotas | 4 |
| D5 doble conversión cross-currency | 2, 3 |
| D6 suma de monedas en crudo | 1, 5 |
| D7 `exchange_rates` vacía | 5 |
| D8 pagos de suscripción | 2, 7 |
| D9 metas sin cuenta + auto-archivo | 2, 6 |
| D10 fechas UTC | 1, 4, 6, 7 |
| U1 navegación mobile | 8 |
| U2 reportes sin período | 9 |
| U3 ajustes de solo lectura | 10 |
| U4 sin theme toggle | 10 |
| U5 sin loading/error | 11 |
| U6 legibilidad en dark | 9 |
| §4 migración de datos existentes | 2 |

Sin huecos.

**Consistencia de nombres entre tareas:** `applyBalance` (Task 3) se usa igual en
4, 6 y 7. `todayLocal` / `addCadenceIso` / `addMonthsIso` (Task 1) se usan con la
misma firma en 4, 6, 7 y 9. `Rate` y `sumInBase` (Task 1) se consumen en 5.
`is_installment_parent`, `dest_amount` y `goal_id` (Task 2) se leen en 3, 4 y 6
con el mismo nombre. `resolvePeriod` (Task 9) se define y consume en la misma
tarea.

**Orden obligatorio:** la Task 2 (migración) debe aplicarse antes que la 3, 4, 6 y
7, porque esas leen columnas que la migración crea. La Task 1 antecede a todas.
Las tareas 8 a 11 son independientes entre sí y de las anteriores.
