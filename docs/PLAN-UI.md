# Plan de mejoras UI/UX — Guita

Fases priorizadas según impacto. Stack adicional: **sonner** (toasts), **Radix primitives vía shadcn** (Dialog, AlertDialog, Select, DropdownMenu), **motion** (versión minimal de framer-motion) para animaciones.

---

## Fase U1 — Cimientos (2 días)

### Accesibilidad de modals/sheets
- [ ] Instalar `sonner`, `motion`, y componentes shadcn: `dialog`, `alert-dialog`, `select`, `dropdown-menu`, `toast`
- [ ] Refactorizar `Modal` para usar `Dialog` de Radix:
  - `role="dialog"`, `aria-modal`, `aria-labelledby`
  - Focus trap automático
  - Cierre con Escape
  - Body scroll lock
  - Restore focus al cerrar
- [ ] Refactorizar `TransactionSheet` para componer sobre `Modal` (eliminar duplicación)
- [ ] Eliminar `components/fab.tsx` (código muerto)
- [ ] Reemplazar todos los `confirm()` nativos por `AlertDialog` styled

### Toasts globales
- [ ] Montar `<Toaster />` de sonner en `providers.tsx`
- [ ] Reemplazar `setError` inline por `toast.error()` en todos los server actions
- [ ] `toast.success()` al crear/editar/eliminar: transacciones, cuentas, categorías, presupuestos, metas, suscripciones, aportes, pagos

### Estados de carga/error a nivel route
- [ ] `app/dashboard/loading.tsx` con skeleton (cards placeholder)
- [ ] `app/dashboard/error.tsx` con reset button
- [ ] `app/loading.tsx` + `app/error.tsx` a nivel raíz
- [ ] `not-found.tsx` branded para 404

---

## Fase U2 — Dark mode + FOUC (1 día)

- [ ] Script inline bloqueante en `<head>` que lea `localStorage` antes del primer paint (sin flash)
- [ ] Eliminar `ThemeInit` con `useEffect` (queda obsoleto)
- [ ] Crear `components/theme-toggle.tsx`:
  - Botón con 3 estados: Claro / Oscuro / Auto
  - Persistencia en `localStorage` key `guita-theme`
  - Escucha cambios de `prefers-color-scheme` cuando está en "auto"
- [ ] Agregar toggle en `ajustes` page
- [ ] `<meta name="theme-color">` dinámica (light/dark) en layout
- [ ] `color-scheme: light dark` en `globals.css`

---

## Fase U3 — Navegación mobile (1 día)

### Bottom nav fix
- [ ] Touch targets ≥ 44px (aumentar `py` y `text-[10px]` → `text-[11px]`)
- [ ] Indicador activo con fondo pill (no solo color)
- [ ] `aria-current="page"` en link activo
- [ ] "Presup." → "Presup." consistente con sidebar (o ambos "Presupuestos")
- [ ] Agregar 6to tab "Más" que abre un **drawer/bottom-sheet** con:
  - Metas, Suscripciones, Cuentas, Categorías
  - Organizadas en secciones

### Sidebar desktop
- [ ] `aria-label="Principal"` en `<nav>`
- [ ] `aria-current="page"` en activo
- [ ] Indicador activo con barra izquierda (border-l-2)
- [ ] Hover sutil con micro-interaction (scale, bg)

---

## Fase U4 — Animaciones con motion (2 días)

- [ ] Instalar `motion` (minimal)
- [ ] Modals: slide-up + fade con `AnimatePresence` (entrada y salida)
- [ ] TransactionSheet: slide-up desde abajo con spring
- [ ] Listas: stagger fade-in en items (`motion.div` con `initial`/`animate`)
- [ ] Tab switches (gasto/ingreso/transfer): crossfade del contenido
- [ ] Barras de progreso: animación de width de 0 al valor
- [ ] Cards: hover lift sutil (`whileHover`)
- [ ] Respetar `prefers-reduced-motion` (desactivar animaciones)

---

## Fase U5 — Pulido estético general (2 días)

### Tokens y estilos
- [ ] Aumentar contraste de `--muted-foreground` (oklch 0.556 → 0.45) para AA
- [ ] Definir token `--warning` (amber) en oklch para dark mode
- [ ] Reemplazar todos los `amber-500` hardcoded por `var(--warning)`
- [ ] Reemplazar `oklch(0.65 0.15 240)` hardcoded en charts por `var(--chart-3)`
- [ ] Centralizar `TYPE_ICONS`, `TYPE_LABELS`, `CURRENCIES` en `lib/constants.ts`
- [ ] Scrollbar styling (thin, themed) en `globals.css`
- [ ] Safe-area-inset para notch/home indicator

### Touch targets
- [ ] Todos los botones ícono ≥ 44px (p-2.5 mínimo)
- [ ] Actions `lg:opacity-0 group-hover` → siempre visibles en mobile
- [ ] Grilla de iconos en categorías: `h-8 w-8` → `h-10 w-10`

### i18n consistente
- [ ] "Transfer" → "Transferencia" en todos los archivos
- [ ] TYPE_LABELS, KIND_LABELS, CADENCE_LABELS centralizados y en español

### Detalles
- [ ] Saludo por hora del día ("Buenos días/tardes/noches")
- [ ] Movimientos del home clickeables (no solo ver, también editar)
- [ ] "Ahorro" visible en mobile (no solo lg)
- [ ] Eliminar duplicación en `cuentas/page.tsx` (renderiza cuentas 2 veces)
- [ ] Mostrar monto mensual equivalente por suscripción
- [ ] Icono lucide (`RefreshCw`) para suscripción normal (no unicode "↻")

---

## Fase U6 — Reportes mejorados (2 días)

- [ ] Tooltips de recharts con `formatMoney` y locale correcto
- [ ] Selector de rango temporal: mes / trimestre / año / personalizado
- [ ] Drill-down: clickear categoría del pie → navega a `/gastos?category=id`
- [ ] Categoría "Otros" cuando hay más de 8 (agrupar el resto)
- [ ] Tablas accesibles como fallback de cada gráfico (screen readers)
- [ ] Usar tokens CSS para colores de charts (no hardcoded)

---

## Fase U7 — Login + onboarding (1 día)

### Login
- [ ] Loading state en botón OAuth (disabled + spinner durante redirect)
- [ ] Manejo de errores OAuth con `toast.error()` y mensajes localizados
- [ ] `aria-label` en logo SVG
- [ ] Pulir detalles visuales (border, focus ring, espaciado)

### Onboarding
- [ ] Manejo de errores con `toast.error()` (no silenciados)
- [ ] Validación de nombre no vacío
- [ ] Incluir `icon` en insert de cuentas preset
- [ ] Numeración de pasos ("1 de 3")
- [ ] `router.refresh()` antes de `router.push()` (fix race condition)

---

## Fase U8 — Ajustes (1 día)

- [ ] Toggle de tema (Claro / Oscuro / Auto) usando `theme-toggle.tsx`
- [ ] Skeleton durante carga del perfil
- [ ] Logout con confirmación styled + manejo de errores

---

## Estimación total: ~12 días-hombre

## Stack final
- **shadcn/ui** (Base UI + Nova) — base existente
- **Radix primitives** vía shadcn: Dialog, AlertDialog, Select, DropdownMenu
- **sonner** — toasts globales
- **motion** — animaciones declarativas minimal
- **tw-animate-css** — utilidades CSS (ya importado, empezar a usar)
- **recharts** — charts (ya instalado)

## Definición de "hecho" (DoD)
- Cero `confirm()` nativos en el codebase
- Cero `lg:opacity-0 group-hover` sin fallback mobile
- Todos los modals con focus trap + Escape + scroll lock
- Todos los server actions con `toast.success`/`toast.error`
- Todas las rutas con `loading.tsx` y `error.tsx`
- Dark mode toggle funcional sin FOUC
- Bottom nav con acceso a todas las secciones
- Lint + typecheck + build sin errores ni warnings
