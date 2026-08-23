# Spec — AppFinanzas (app de finanzas personales)

App web-first (PWA) para gestionar finanzas personales, con carga de gastos desde Telegram y foto de tickets. Pensada para un usuario solo en v1, pero con el modelo de datos preparado para presupuestos compartidos (household) a futuro.

---

## 1. Objetivos

- Registrar gastos, ingresos, transferencias, suscripciones y compras en cuotas de forma rápida.
- Cargar movimientos desde **Telegram** con lenguaje natural y desde **foto de tickets**.
- Tener visibilidad: a dónde va el dinero, comparar contra presupuestos, seguir metas de ahorro.
- Multi-moneda con conversión automática a una moneda base.
- Experiencia mobile-first, instalable como app (PWA).

## 2. No-objetivos (v1)

- Presupuestos compartidos / multi-usuario (el esquema lo deja preparado, no se implementa UI).
- Sincronización bancaria / Open Finance.
- Tracking de inversiones y préstamos.
- Bot de WhatsApp (solo Telegram en v1).
- App nativa en stores (se envuelve con Capacitor más adelante si hace falta).

## 3. Usuarios y alcance

- **Usuario principal:** yo. Una sola cuenta, datos aislados por `user_id` (RLS).
- **Futuro:** varios usuarios que comparten un `household` con presupuestos/cuentas en común.

## 4. Funcionalidades (v1)

### 4.1 Auth y onboarding
- Login solo con OAuth (Google / Apple) vía Supabase Auth.
- Onboarding: elegir moneda base, crear cuentas/wallets iniciales, confirmar categorías predefinidas.

### 4.2 Cuentas / métodos de pago
- Tipos: efectivo, banco, tarjeta de crédito, tarjeta de débito, billetera, ahorro.
- Cada cuenta tiene moneda propia y saldo.
- Las transferencias mueven dinero entre cuentas (con conversión si difiere la moneda).

### 4.3 Transacciones
- Tipos: `expense`, `income`, `transfer`, `subscription`.
- Campos: monto, moneda, categoría, subcategoría, cuenta, nota, fecha, etiquetas, método de pago, comprobante.
- **Multi-moneda:** se guarda monto original + monto convertido a moneda base + rate usado.
- **Compras en cuotas:** una compra genera 1 transacción padre + N hijas (una por mes), cada una se imputa al presupuesto del mes correspondiente. Saldo pendiente visible.
- Origen del movimiento: `manual`, `bot`, `receipt`, `import`.

### 4.4 Categorías
- Predefinidas (Comida, Transporte, Vivienda, Ocio, Salud, Servicios, etc.) + custom.
- Subcategorías (jerarquía padre/hijo).
- Por categoría: ícono, color, tipo (gasto/ingreso), orden.

### 4.5 Suscripciones / recurrentes
- Registro de gastos periódicos (Netflix, alquiler, gimnasio) con cadencia (semanal/mensual/anual) y próxima fecha.
- Vista de total mensual recurrente.

### 4.6 Presupuestos
- Presupuesto **mensual por categoría** (y opcional global).
- Barra de avance: gastado vs límite, estado (ok / cerca / excedido).
- Alerta al superar o estar cerca del límite.

### 4.7 Metas de ahorro
- Nombre, monto objetivo, fecha objetivo, progreso (aportes vinculados o manuales).

### 4.8 Bot de Telegram
- Pareo: la app muestra un código; al enviarlo al bot se vincula `telegram_chat_id` con el `user_id`.
- Se envía un mensaje tipo *"gasté 4500 en super"* → el bot parsea con LLM y crea la transacción (borrador que se puede confirmar o auto-confirmar según preferencia).
- Comandos: `/gasto`, `/ingreso`, `/resumen`, `/undo`, `/help`.
- Soporta multi-moneda detectando símbolo/código (USD, ARS, etc.).

### 4.9 Foto de ticket / factura
- Se sube una foto → Edge Function con LLM vision (gpt-4o-mini) lee: total, moneda, fecha, items/categoría sugerida.
- Devuelve un borrador que el usuario confirma/edita antes de guardar.

### 4.10 Reportes
- **Resumen mensual:** ingresos, gastos, ahorro, comparativa vs mes anterior.
- **Desglose por categoría:** gráfico de torta + tabla.
- **Tendencias temporales:** línea de gastos/ahorro en el tiempo.
- **Avance vs presupuesto:** por categoría con estado.
- **Top gastos / Pareto:** categorías que más concentran gasto.
- **Por método de pago:** desglose por cuenta/tarjeta.
- Filtros: rango de fechas, categoría, cuenta, tipo.

### 4.11 Multi-moneda
- Moneda base definida por el usuario.
- Tabla de `exchange_rates` actualizada a diario (cron) desde API gratuita, **editable** manualmente.
- Reportes siempre en moneda base; transacciones muestran monto original + convertido.

### 4.12 PWA / UX
- Mobile-first, responsive, instalable (manifest + service worker con Serwist).
- Offline: caché de lectura de datos recientes; escritas se encolan y sincronizan.

## 5. Historias de usuario (muestra)

- Como usuario, quiero agregar un gasto en 2 toques desde la app.
- Como usuario, quiero mandar un mensaje a Telegram y que se registre el gasto automáticamente.
- Como usuario, quiero sacar foto del ticket del super y que se cargue el gasto para confirmar.
- Como usuario, quiero ver cuánto me queda del presupuesto de Comida este mes.
- Como usuario, quiero ver en qué gasté más este mes vs el anterior.
- Como usuario, quiero registrar una compra en 6 cuotas y que se impute mes a mes.
- Como usuario, quiero ver mis gastos en USD convertidos a mi moneda base.

## 6. Requisitos no-funcionales

- **Seguridad:** OAuth únicamente, RLS por `user_id`, secrets en Supabase vault/env, pareo del bot por código.
- **Privacidad:** datos cifrados en tránsito (TLS) y reposo (Supabase). Sin tracking de terceros.
- **Performance:** first load < 2.5s LCP, listas virtualizadas, queries indexadas.
- **Disponibilidad:** depende de Supabase + Vercel; sin SLA específico en v1.
- **i18n:** UI en español, estructura preparada para EN.
- **Accesibilidad:** componentes accesibles (shadcn/ui cumple WCAG básico).

## 7. Métricas de éxito (personal)

- Tiempo para registrar un gasto desde Telegram: < 10 s.
- Uso real: registrar >= 80% de los gastos en la app.
- Cero fricción suficiente como para no abandonar el registro tras 1 mes.
