# Design System — Guita

Sistema visual de la app. Inspirado en **Monzo** (cálido, redondeado, card-based) con acento **verde esmeralda** (Cash App / Wise) y tipografía **Inter** (estándar fintech).

---

## 1. Marca

- **Nombre:** Guita
- **Tagline:** "Tu guita, en claro."
- **Personalidad:** cercana, cotidiana, local (es-AR), sin formalidad bancaria pero prolija. No es un banco, es tu app personal.

## 2. Paleta

### Acento de marca — Esmeralda
| Token | Claro | Oscuro | Uso |
|-------|-------|--------|-----|
| `--primary` | `oklch(0.62 0.15 162)` (emerald-600) | `oklch(0.69 0.17 162)` (emerald-500) | Botones, FAB, estados activos, acentos |
| `--primary-foreground` | blanco | `oklch(0.145 0 0)` | Texto sobre primary |
| `--ring` | emerald-500 | emerald-400 | Focus rings |

### Neutros (cálidos, casi neutros)
Fondo blanco en claro; negro suave en oscuro. Tarjetas blancas con sombra suave en claro, `oklch(0.205 0 0)` en oscuro.

### Categorías (paleta multicolor para chips y gráficos)
Emerald, Amber, Sky, Violet, Rose, Teal, Orange, Indigo. Cada categoría predefinida tiene un color asignado; las custom eligen de esta paleta.

### Semánticos
- `--destructive`: rojo para gastos/errores (gasto = rojo, ingreso = esmeralda).
- En reportes: gasto rojo, ingreso esmeralda, ahorro índigo.

## 3. Tipografía

- **UI / texto:** **Inter** (next/font/google) — pesos 400/500/600/700.
- **Montos y números:** **Geist Mono** — monoespaciado para alinear cifras, sensación técnica-financiera.
- Tamaños: base 16px, escalas Tailwind. Títulos grandes para saldos (text-3xl/4xl, tabular-nums).

## 4. Forma y espacio

- **Radius generoso (Monzo):** `--radius: 0.875rem`. Tarjetas `rounded-2xl`/`rounded-3xl`, botones `rounded-full` o `rounded-xl`.
- **Espaciado mobile-first:** mucho aire, padding generoso en cards (`p-5`/`p-6`), gap amplio.
- **Sombras:** suaves y difusas en claro (`shadow-sm`/`shadow-md`), sin sombras en oscuro (bordes sutiles).
- **Densidad:** espaciada, no dashboard denso.

## 5. Componentes clave

- **Cards:** blancas, `rounded-2xl`, borde fino `border`, sombra suave. Agrupan saldos, resúmenes, transacciones.
- **Bottom tab bar:** fija abajo, 5 tabs (Inicio, Gastos, Presupuestos, Reportes, Ajustes). Icono outline inactivo, relleno + esmeralda activo.
- **FAB:** botón esmeralda circular para "Agregar movimiento" (esquina inferior derecha sobre la tab bar).
- **Chips de categoría:** pill `rounded-full`, color de la categoría como fondo suave (tinte 10-15%) + texto del color sólido.
- **Listas de transacciones:** fila con icono de categoría en círculo coloreado, descripción, nota, monto en mono (rojo gasto / esmeralda ingreso).
- **Gráficos:** Recharts. Torta de categorías con la paleta; líneas de tendencia en esmeralda; barras de presupuesto con estado (ok esmeralda / cerca amber / excedido rojo).

## 6. Iconografía

- **Lucide** (ya configurado con shadcn Nova).
- Mixto: **outline** en navegación inactiva y UI; **relleno/solid** en tab activa y estados destacados.

## 7. Modo claro/oscuro

- Toggle manual + "auto" (sigue `prefers-color-scheme`).
- Preferencia guardada (localStorage / settings).
- Sin flash al cargar (class en `<html>` desde el server o script inline temprano).

## 8. Idioma y formato

- **UI:** español (es).
- **Montos:** formato latam **es-AR** → `$ 12.345,50` (coma decimal, punto miles, símbolo `$` + código de moneda si no es la base).
- **Fechas:** `23/08/2026` (dd/mm/yyyy).

## 9. Movimiento

- Transiciones sutiles (`duration-200`), hover con leve elevación en cards.
- Entradas de lista con fade-in breve. Sin animaciones ruidosas.

## 10. Estados vacíos

- Ilustraciones/íconos simples + copy cercano: *"Todavía no cargaste gastos este mes. Mandale uno por Telegram o tocá el botón verde."*
