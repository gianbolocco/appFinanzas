# Plan de implementación — AppFinanzas

Roadmap dividido en fases incrementales. Cada fase entrega algo usable. Tiempos orientativos para desarrollo solo (no full-time).

---

## Fase 0 — Setup (1–2 días)
- [ ] Crear repo Git, `.gitignore`, README mínimo.
- [ ] Inicializar Next.js 15 (App Router, TS, Tailwind, ESLint, Prettier).
- [ ] Instalar y configurar shadcn/ui.
- [ ] Crear proyecto Supabase; instalar Supabase CLI; `supabase init`.
- [ ] Configurar env vars (`.env.local`, `.env.example`).
- [ ] CI: GitHub Actions con `lint`, `typecheck`, `build`.
- [ ] Elegir nombre de la app + branding básico (colores, logo placeholder).

**Entregable:** app vacía deployada en Vercel + proyecto Supabase vinculado.

## Fase 1 — Auth + onboarding + modelo de datos (2–3 días)
- [ ] Migración inicial: esquema completo (sección 5 de ARCHITECTURE.md) + índices.
- [ ] Políticas RLS en todas las tablas.
- [ ] Supabase Auth con OAuth Google y Apple; callback y sesión en Next.js (middleware).
- [ ] Pantalla de login; protección de rutas privadas.
- [ ] Onboarding: elegir moneda base, crear cuentas iniciales, confirmar categorías predefinidas.
- [ ] Seed de categorías predefinidas (ES).
- [ ] Tipos generados con `supabase gen types typescript`.

**Entregable:** usuario puede loguearse y completar el onboarding.

## Fase 2 — Transacciones + cuentas + categorías + multi-moneda (4–5 días)
- [ ] CRUD de cuentas (efectivo, banco, tarjetas, etc.) con saldo.
- [ ] CRUD de categorías y subcategorías (predefinidas + custom).
- [ ] CRUD de transacciones (expense/income/transfer) con formulario react-hook-form + zod.
- [ ] Selección de moneda por transacción + conversión a base usando `exchange_rates`.
- [ ] Edge Function `/exchange-rates-cron` + job `pg_cron` diario; UI para editar rates.
- [ ] Lista de transacciones con filtros (fecha, categoría, cuenta, tipo) y virtualización.
- [ ] Etiquetas (tags) en transacciones.
- [ ] **Cuotas:** UI para registrar compra en N cuotas → genera padre + hijas; vista de saldo pendiente.

**Entregable:** registro completo de movimientos multi-moneda con cuotas.

## Fase 3 — Presupuestos + metas + suscripciones (3–4 días)
- [ ] CRUD de presupuestos mensuales por categoría (y opcional global).
- [ ] Vista de avance vs presupuesto con estado (ok/cerca/excedido) y alertas.
- [ ] CRUD de metas de ahorro con progreso y aportes.
- [ ] CRUD de suscripciones con cadencia y próxima fecha; total mensual recurrente.

**Entregable:** control de presupuesto y seguimiento de metas y recurrentes.

## Fase 4 — Reportes (3–4 días)
- [ ] Vista Resumen mensual (ingresos/gastos/ahorro + comparativa mes anterior).
- [ ] Desglose por categoría (torta + tabla).
- [ ] Tendencias temporales (línea).
- [ ] Avance vs presupuesto (barras horizontales con estado).
- [ ] Top gastos / Pareto (barras ordenadas + % acumulado).
- [x] Gráficos de ingresos vs. gastos, top gastos por categoría.
- [x] Filtros globales de rango (selector de período, 2026-08-24).

> **Nota (2026-08-24):** las Fases 2–4 quedaron con defectos de integridad que se
> corrigieron por separado. Ver [SPEC-FIXES.md](SPEC-FIXES.md) y el plan
> `superpowers/plans/2026-08-24-fixes-datos-y-ux.md`.
- [ ] Queries optimizadas (vistas materializadas o endpoints de agregación si hace falta).

**Entregable:** dashboard de reportes completo.

## Fase 5 — Bot de Telegram (3–4 días)
- [ ] Crear bot con BotFather; guardar token en Supabase secrets.
- [ ] Edge Function `/pair-telegram`: genera código, vincula `chat_id` ↔ `user_id`.
- [ ] UI en la app: mostrar código de pareo y estado de vinculación.
- [ ] Edge Function `/telegram-webhook`: verifica pareo, parsea con gpt-4o-mini (structured output), inserta transacción.
- [ ] Botones inline "Confirmar / Editar" para borradores.
- [ ] Comandos: `/gasto`, `/ingreso`, `/resumen`, `/undo`, `/help`.
- [ ] Manejo de errores y mensajes de ayuda amigables.
- [ ] Tests con Vitest para el parser (casos en ES/EN, multi-moneda).

**Entregable:** cargar gastos mandando un mensaje a Telegram.

## Fase 6 — Foto de ticket / OCR (2–3 días)
- [ ] Upload a Supabase Storage con políticas privadas + signed URLs.
- [ ] Edge Function `/receipt-ocr` con gpt-4o-mini vision → JSON estructurado.
- [ ] UI: tomar/subir foto → formulario precargado → confirmar/editar → guardar con `source = receipt`.
- [ ] Manejo de imágenes borrosas / no reconocidas.

**Entregable:** cargar un gasto sacándole foto al ticket.

## Fase 7 — PWA + offline + pulido (2–3 días)
- [ ] Configurar Serwist (manifest, icons, service worker).
- [ ] Offline: caché de lectura de datos recientes; cola de escritas con sync.
- [ ] Modo offline indicator.
- [ ] Ajustes de UX mobile, animaciones sutiles, estados vacíos y de carga.
- [ ] Accesibilidad (focus, contraste, aria).
- [ ] Sentry para errores.
- [ ] Deploy a producción + pruebas en móvil real.

**Entregable:** PWA instalable y usable en el celular, offline básico.

## Fase 8 (futuro, fuera de v1)
- [ ] Households: presupuestos y cuentas compartidas (UI multi-usuario + invites).
- [ ] Sync bancaria / Open Finance.
- [ ] Bot de WhatsApp (Cloud API + verificación Meta Business).
- [ ] Tracking de inversiones y préstamos.
- [ ] Wrap con Capacitor para stores.
- [ ] Exportación/importación CSV.
- [ ] Notificaciones push y recordatorios.

---

## Estimación total v1 (Fases 0–7)
Aprox. **20–26 días-hombre** de desarrollo, asumiendo solo-dev y conocimiento del stack. Con ajustes reales puede variar ±30%.

## Definición de "hecho" (DoD) por fase
- Funciona en local y en deploy (Vercel + Supabase).
- Tipos correctos (sin `any`), lint y typecheck sin errores.
- RLS verificada (no hay acceso cross-user).
- Mínimos tests en edge functions de parsing/OCR.
- Commit por feature; PR revisado (aunque sea uno mismo) antes de mergear.
