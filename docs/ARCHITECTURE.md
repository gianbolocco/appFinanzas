# Arquitectura — AppFinanzas

## 1. Stack

| Capa | Tecnología | Por qué |
|------|------------|---------|
| Frontend | **Next.js 15** (App Router) + TypeScript + Tailwind + **shadcn/ui** | Web-first, PWA, SSR/rutas, ecosistema maduro |
| PWA | **Serwist** (service worker) | Offline + instalable, sucesor de Workbox para Next |
| Estado/servidor | **TanStack Query** + **Zustand** | Cache de servidor + estado de UI simple |
| Formularios | **react-hook-form** + **zod** | Validación tipada |
| Charts | **Recharts** | Torta, líneas, barras; simple y suficiente |
| Backend/BaaS | **Supabase** (Postgres + Auth + RLS + Edge Functions Deno + Storage + Realtime) | Cero servidores, todo integrado |
| Auth | Supabase Auth con **OAuth Google + Apple** | Sin contraseñas |
| Bot | **Telegram Bot API** → webhook → Supabase Edge Function | Gratis, sin aprobación |
| IA / parseo | **OpenAI gpt-4o-mini** (texto + visión) con structured outputs (JSON schema) | Barato, robusto en ES/EN, lee tickets |
| Tipos de cambio | **exchangerate.host** (API gratuita) vía **pg_cron** diario | Rates auto + editables |
| Hosting | **Vercel** (Next.js) + **Supabase Cloud** | Deploy simple, free tier suficiente |
| Monitoreo | **Sentry** + logs de Supabase | Errores frontend/edge |
| Calidad | ESLint, Prettier, TypeScript estricto, **Vitest** (edge functions) | Mantenibilidad |
| CI | GitHub Actions (lint, typecheck, test, build) | Pre-merge |

## 2. Diagrama de componentes

```
                         ┌─────────────────────────────────────────┐
                         │              Supabase Cloud              │
                         │  Postgres (RLS)  Auth  Storage  Realtime │
                         │       Edge Functions (Deno)              │
                         │       pg_cron (rates diarios)            │
                         └──────────────▲────────────────▲──────────┘
                                        │                │
   HTTPS / TanStack Query               │                │ webhook
                                        │                │
┌─────────────┐        ┌────────────────┴───┐     ┌──────┴──────────────┐
│  Next.js    │        │  Edge Function      │     │  Edge Function      │
│  PWA (Vercel)│       │  /telegram-webhook  │     │  /receipt-ocr       │
│  shadcn/ui  │        │  parse LLM → insert │     │  vision LLM → draft │
│  Recharts   │        └─────────────────────┘     └─────────────────────┘
└─────────────┘                    ▲
                                   │
                            ┌──────┴──────┐
                            │  Telegram   │ (usuario manda "gasté 4500 en super")
                            └─────────────┘

   Otros edge functions: /exchange-rates-cron (pg_cron), /pair-telegram (pareo)
```

## 3. Flujo del bot de Telegram

1. Usuario vincula Telegram: la app genera un **código de pareo** → lo envía al bot → Edge Function guarda `bot_links { user_id, telegram_chat_id }`.
2. Usuario envía un mensaje de gasto → Telegram webhook → Edge Function:
   - Verifica que el `chat_id` esté pareado.
   - Llama a `gpt-4o-mini` con prompt estructurado → devuelve `{amount, currency, category, note, date, type}`.
   - Mapea categoría a una existente o crea sugerencia.
   - Inserta la transacción (auto-confirmar o devolver borrador con botones inline "Confirmar / Editar").
3. Comandos: `/gasto`, `/ingreso`, `/resumen`, `/undo`, `/help`.

## 4. Flujo de foto de ticket

1. Usuario sube foto desde la app → Supabase Storage.
2. Frontend llama a Edge Function `/receipt-ocr` con la URL del objeto.
3. Edge Function envía la imagen a `gpt-4o-mini` (vision) → JSON `{total, currency, date, merchant, items, suggested_category}`.
4. Frontend muestra un formulario precargado → usuario confirma/edita → guarda la transacción con `source = receipt`.

## 5. Modelo de datos (Postgres)

Esquema simplificado (todas las tablas con `user_id` + RLS salvo catálogos compartidos).

```
users              (id PK, base_currency, locale, timezone, created_at)
households         (id PK, name, created_at)                       -- futuro
household_members  (household_id FK, user_id FK, role)             -- futuro

categories         (id PK, user_id, household_id NULL, name, kind,
                    parent_id NULL, icon, color, "order",
                    is_predefined, created_at)                     -- subcategorías vía parent_id

accounts           (id PK, user_id, name, type, currency, balance, created_at)

transactions       (id PK, user_id, household_id NULL, type, amount,
                    currency, amount_base, exchange_rate, category_id,
                    account_id, to_account_id NULL, note, date,
                    source, receipt_url NULL,
                    installments_total NULL, installment_number NULL,
                    parent_transaction_id NULL, created_at)

tags               (id PK, user_id, name)
transaction_tags   (transaction_id FK, tag_id FK)

subscriptions      (id PK, user_id, name, amount, currency, cadence,
                    next_date, category_id, account_id, active, created_at)

budgets            (id PK, user_id, household_id NULL, category_id NULL,
                    period, amount_limit, currency, created_at)

goals              (id PK, user_id, name, target_amount, current_amount,
                    target_date, currency, created_at)

exchange_rates     (id PK, base, quote, rate, date, source, created_at)
                    UNIQUE(base, quote, date)

bot_links          (id PK, user_id UNIQUE, telegram_chat_id, telegram_user_id,
                    created_at)

pair_codes         (id PK, user_id, code, expires_at, used_at NULL)
```

### Cuotas (installments)
- La compra padre: `installments_total = N`, `installment_number = NULL`.
- N hijas: `installment_number = 1..N`, `parent_transaction_id = padre`, `date = fecha + i meses`.
- Cada hija se imputa al presupuesto del mes en que vence.
- Saldo pendiente = suma de hijas con `date > hoy`.

### Multi-moneda
- Al insertar: se busca `exchange_rate(base, currency, date)` (más cercano); si no existe se crea a partir del último rate.
- `amount_base = amount * rate`.
- Rates diarios: `pg_cron` → Edge Function `/exchange-rates-cron` → upsert en `exchange_rates`.
- Editable: UI permite sobreescribir un rate (marca `source = manual`).

### RLS (ejemplo)
- `transactions`: `USING (user_id = auth.uid())`.
- `categories` predefinidas: `USING (user_id = auth.uid() OR is_predefined = true)`.
- `exchange_rates`: lectura pública (todos los usuarios), escritura solo service role.

## 6. Seguridad

- OAuth únicamente (Google/Apple). Sin email/password.
- RLS en todas las tablas con datos de usuario.
- Edge Functions usan **service role key** solo server-side; nunca expuesta al cliente.
- Pareo de bot por código de un solo uso con expiración.
- Secrets (OpenAI, Telegram token) en Supabase vault / env vars de Edge Functions.
- URLs de comprobantes en Storage con políticas privadas (acceso vía signed URL).

## 7. Decisiones y trade-offs

- **Supabase vs backend custom:** Supabase elimina mantención de servidores; suficiente para v1 y escala decente. Si la app crece mucho, se puede migrar edge functions a un backend dedicado.
- **Next.js PWA vs React Native:** web-first fue decisión del usuario; la PWA cubre mobile por ahora y se puede envolver con Capacitor o migrar a RN después.
- **gpt-4o-mini vs parseo regex:** el LLM maneja variabilidad de lenguaje natural y ES/EN; fallback regex para casos simples y para reducir costo/latencia.
- **Telegram vs WhatsApp:** Telegram es gratis y sin aprobación; WhatsApp queda para una v2.

## 8. Estructura de repositorio propuesta

```
appfinanzas/
├─ apps/web/                 # Next.js (App Router)
│  ├─ app/                   # rutas (dashboard, transactions, budgets, reports, settings)
│  ├─ components/            # UI (shadcn) + features
│  ├─ lib/                   # supabase client, queries, utils
│  ├─ hooks/                 # TanStack Query hooks
│  └─ types/                 # tipos compartidos (zod schemas)
├─ supabase/
│  ├─ migrations/            # SQL migrations (esquema, RLS)
│  ├─ functions/             # Edge Functions (Deno)
│  │  ├─ telegram-webhook/
│  │  ├─ receipt-ocr/
│  │  ├─ exchange-rates-cron/
│  │  └─ pair-telegram/
│  └─ config.toml
├─ packages/db/              # tipos generados desde Postgres (supabase gen types)
├─ docs/                     # SPEC, ARCHITECTURE, PLAN
└─ .github/workflows/        # CI
```
