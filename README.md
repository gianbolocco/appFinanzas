# AppFinanzas

App web-first (PWA) para gestión de finanzas personales, con carga de gastos desde Telegram y foto de tickets.

## Stack

- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui + PWA (Serwist)
- **Backend/BaaS:** Supabase (Postgres + Auth + RLS + Edge Functions Deno + Storage + Realtime)
- **Auth:** OAuth Google + Apple
- **Bot:** Telegram Bot API → webhook → Edge Function (parseo con gpt-4o-mini)
- **OCR de tickets:** gpt-4o-mini vision
- **Tipos de cambio:** exchangerate.host vía pg_cron diario
- **Hosting:** Vercel + Supabase Cloud
- **Calidad:** ESLint, Prettier, Vitest

## Estructura

```
appfinanzas/
├─ apps/web/          # Next.js (App Router)
├─ packages/db/       # tipos generados desde Postgres
├─ supabase/          # migrations + edge functions + config
├─ docs/              # SPEC, ARCHITECTURE, PLAN
└─ .github/workflows/ # CI
```

## Documentación

- [Spec](docs/SPEC.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [Plan de implementación](docs/PLAN.md)

## Puesta en marcha (local)

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local  # completar valores
pnpm dev
```

## Scripts

| Comando           | Descripción                          |
| ----------------- | ------------------------------------ |
| `pnpm dev`        | Levanta Next.js en modo desarrollo   |
| `pnpm build`      | Build de producción                  |
| `pnpm lint`       | ESLint                               |
| `pnpm typecheck`  | TypeScript sin emit                  |
| `pnpm test`       | Tests (Vitest)                       |
