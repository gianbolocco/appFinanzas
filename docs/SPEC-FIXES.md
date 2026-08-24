# Spec — Corrección de integridad de datos y UX crítico

Estado: propuesto · Fecha: 2026-08-24 · Alcance: apps/web + supabase

Este spec cubre los bugs que corrompen saldos y reportes, más la deuda de UX
que hace inusable la app en mobile. No incluye Fase 5 (Telegram), Fase 6 (OCR)
ni Fase 7 (PWA/offline).

---

## 1. Problema

La app registra movimientos correctamente en la mayoría de los casos simples,
pero tres mecanismos —transferencias, cuotas y multi-moneda— producen números
incorrectos que se propagan a todos los agregados. Además, cuatro pantallas
terminadas no son alcanzables desde el teléfono.

### 1.1 Defectos de datos

| # | Defecto | Efecto observable |
|---|---------|-------------------|
| D1 | `createTransaction` guarda las transferencias como un par `expense`+`income` en vez de una fila `transfer` | Mover plata entre cuentas propias infla ingresos y gastos del mes. El filtro "Transfer" nunca devuelve resultados |
| D2 | La contrapartida de una transferencia se localiza por `(cuenta_origen, cuenta_destino, fecha)` | Dos transferencias el mismo día entre las mismas cuentas: borrar una borra las dos |
| D3 | Una compra en cuotas inserta el padre con el monto total **y** las N hijas; nada filtra al padre | El gasto se cuenta dos veces en listas y agregados |
| D4 | Al crear cuotas se resta 1 cuota del saldo; al borrar se devuelve el total | El saldo de la cuenta queda inflado tras borrar |
| D5 | `getAccountMonthlyStats` y `getAccountBalanceAtDate` multiplican por `exchange_rate` un monto que ya está convertido | "Transf. entrantes" y "Saldo mes anterior" salen inflados por el factor de cambio |
| D6 | `getTotalBalance` suma saldos de distintas monedas sin convertir | El patrimonio neto del dashboard es un número sin significado |
| D7 | `exchange_rates` nunca se puebla; `fetchRate` cae siempre a `1` | `amount_base` es incorrecto para toda transacción en moneda ≠ base |
| D8 | `registerSubscriptionPayment` no es idempotente ni valida `account_id` | Dos toques crean dos gastos y avanzan dos períodos; sin cuenta, ningún saldo se mueve |
| D9 | `contributeToGoal` no descuenta de ninguna cuenta y auto-archiva al completar | La plata ahorrada aparece de la nada; la meta lograda desaparece de la vista |
| D10 | Las fechas por defecto usan `new Date().toISOString()` (UTC) | En UTC−3, después de las 21:00 el movimiento se carga con fecha de mañana |

### 1.2 Defectos de UX

| # | Defecto | Efecto observable |
|---|---------|-------------------|
| U1 | El bottom nav tiene 5 destinos; el sidebar tiene 9 | Metas, Suscripciones, Cuentas y Categorías son inalcanzables en mobile |
| U2 | Reportes nunca pasa `from`/`to` a las queries que los aceptan | Todos los gráficos mezclan el histórico completo sin indicar período |
| U3 | Ajustes es solo lectura | No se puede cambiar nombre ni moneda base, contra lo que promete el onboarding |
| U4 | Nadie escribe la clave `guita-theme` que lee `theme-init.tsx` | El modo oscuro definido en DESIGN.md §7 es inalcanzable |
| U5 | No existe ningún `loading.tsx` ni `error.tsx` | Cada navegación congela la pantalla anterior; un throw en una query muestra la pantalla de error de Next |
| U6 | Los tooltips de Recharts no fijan `backgroundColor`; el detalle de cuenta usa `text-white/70` fijo | Texto ilegible en tema oscuro |

---

## 2. Decisiones de diseño

Tomadas con el usuario el 2026-08-24:

- **Multi-moneda:** cotizaciones automáticas vía Edge Function + `pg_cron` diario
  (según ARCHITECTURE.md §1), no carga manual.
- **Metas de ahorro:** un aporte descuenta de una cuenta real y deja rastro como
  transacción.
- **Alcance:** defectos de datos D1–D10 y de UX U1–U6. Fuera de alcance:
  formato de montos es-AR al tipear, paginación real de movimientos, PWA.

---

## 3. Solución

### 3.1 Transferencias: una fila, no dos (D1, D2, D5)

Una transferencia pasa a ser **una única fila** con `type = 'transfer'`,
`account_id` = origen y `to_account_id` = destino. El esquema ya lo contempla
(`check (type <> 'transfer' or to_account_id is not null)`) y
`getAccountTransactions` ya consulta ambas columnas.

Para transferencias entre monedas distintas se agrega la columna
`transactions.dest_amount`: el monto acreditado en la cuenta destino.
`amount` queda en la moneda del origen; `exchange_rate` conserva su significado
actual (conversión a moneda base) y deja de estar sobrecargado con la tasa
origen→destino.

Consecuencias:

- D2 desaparece: no hay contrapartida que buscar. Borrar la fila revierte ambos
  saldos.
- D1 desaparece: los agregados de ingreso/gasto filtran por `type` y `transfer`
  ya no aparece en ninguno de los dos.
- D5 desaparece: `dest_amount` se lee tal cual, sin multiplicar.

Los datos existentes se migran colapsando cada par en una fila (ver §4).

**Regla de agregación (aplica a todas las queries):** una transferencia nunca
cuenta como ingreso ni como gasto. En la vista de una cuenta sí se muestra, con
signo negativo si la cuenta es origen y positivo si es destino.

### 3.2 Cuotas: el padre no se cuenta (D3, D4)

Se agrega una columna generada:

```sql
is_installment_parent boolean
  generated always as (installments_total is not null and installment_number is null) stored
```

Todas las listas y agregados filtran `is_installment_parent = false`. El padre
se conserva como registro de la compra original (permite calcular saldo
pendiente) pero nunca se suma ni se lista.

El saldo de la cuenta se ajusta **por cuota vencida**: al crear una compra en N
cuotas se resta únicamente la suma de las cuotas con `date <= hoy` (normalmente
la primera). Al borrar el padre se revierte exactamente esa misma suma.

La lógica de "qué cuotas están vencidas" vive en una función pura testeable.

### 3.3 Cotizaciones automáticas (D6, D7)

- Edge Function `supabase/functions/exchange-rates-cron` que consulta
  exchangerate.host y hace upsert en `exchange_rates` con `source = 'api'`.
  La API requiere `access_key`; se guarda como secret de Supabase.
- Job `pg_cron` diario a las 09:00 UTC que invoca la función vía `pg_net`.
- `fetchRate` busca el rate más reciente con `date <= fecha de la transacción`;
  si no hay ninguno, cae a `1` y **registra el faltante** en vez de silenciarlo.
- `getTotalBalance` deja de sumar en crudo: convierte cada saldo a moneda base
  con el rate vigente y devuelve además el detalle por moneda. Si falta un rate,
  el total se marca como parcial y la UI lo indica en vez de mentir.

Los totales de Presupuestos y Metas aplican la misma conversión.

### 3.4 Suscripciones (D8)

- Índice único parcial sobre `(subscription_id, date)`: dos registros del mismo
  pago el mismo día son rechazados por la base, no por código de aplicación.
- `registerSubscriptionPayment` exige `account_id`; si la suscripción no tiene
  cuenta asignada, devuelve un error accionable y la UI ofrece asignarla.
- El pago se registra con fecha `next_date` (la fecha que efectivamente vencía),
  no con la fecha de hoy.

### 3.5 Metas que mueven plata (D9)

- Nueva columna `transactions.goal_id` (espejo del patrón `subscription_id`).
- Un aporte crea una transacción `expense` con `goal_id` seteado y
  `category_id = null`, descuenta de la cuenta elegida, y guarda su id en
  `goal_contributions.transaction_id` (columna que ya existe sin uso).
- El formulario de aporte pasa a exigir cuenta origen.
- **Los aportes a metas no cuentan como gasto:** `getMonthlySummary` los agrupa
  en un tercer bucket `savings`. Sale plata de la cuenta corriente, pero no se
  consumió.
- Completar una meta ya no la archiva. Se muestra en "Activas" con estado
  "Completada"; archivar sigue siendo una acción manual.

### 3.6 Fechas locales (D10)

Función `todayLocal()` que construye `YYYY-MM-DD` a partir de la fecha local del
usuario. Reemplaza todo uso de `toISOString().slice(0, 10)` que represente "hoy"
o un límite de mes.

### 3.7 Navegación mobile (U1)

El bottom nav mantiene 4 destinos fijos (Inicio, Gastos, Presupuestos, Reportes)
y reemplaza "Ajustes" por **"Más"**, que abre una hoja con los cinco destinos
restantes: Metas, Suscripciones, Cuentas, Categorías, Ajustes. El botón `+` se
conserva.

### 3.8 Reportes con período (U2)

Selector de período en el encabezado con cuatro opciones: **Este mes**
(por defecto), Mes anterior, Últimos 3 meses, Todo. La selección viaja por
`searchParams` para que la página siga siendo un Server Component y el período
quede en la URL (compartible, recargable). El período elegido se muestra como
subtítulo de cada sección.

`getCategoryBreakdown` y `getBreakdownByAccount` reciben el rango; las
tendencias de 6 meses no se filtran (siempre muestran 6 meses).

### 3.9 Ajustes editables y tema (U3, U4)

Ajustes pasa a permitir editar nombre y moneda base, y agrega un selector de
tema con tres estados: Claro / Oscuro / Automático. La preferencia se persiste
en `localStorage` bajo `guita-theme` (la clave que `theme-init.tsx` ya lee) y se
aplica sin recargar.

Cambiar la moneda base no reconvierte datos históricos: cambia la moneda en que
se presentan los totales. La UI lo advierte.

### 3.10 Estados de carga y error (U5)

- `loading.tsx` en cada ruta del dashboard, con esqueletos que respetan la forma
  del contenido real (cards redondeadas, no spinners centrados).
- `error.tsx` en la raíz del dashboard, con copy en español y botón de reintento.
- `not-found.tsx` para cuentas inexistentes.

### 3.11 Legibilidad en tema oscuro (U6)

- Los tooltips de Recharts usan `var(--card)` / `var(--card-foreground)`.
- El detalle de cuenta usa `text-primary-foreground` con opacidad en vez de
  `text-white/70`.

---

## 4. Migración de datos existentes

La migración `0005` incluye un backfill que colapsa los pares de transferencia
ya guardados:

1. Localiza filas `income` cuya nota empieza con `Transfer ←` que tengan una
   `expense` complementaria con nota `Transfer →`, mismo `date`, y cuentas
   cruzadas.
2. Actualiza la fila `expense` a `type = 'transfer'` con
   `dest_amount` = monto de la `income`.
3. Borra la fila `income`.

El backfill es idempotente y no toca filas que no matcheen el patrón. Los
saldos de las cuentas **no** se recalculan: ya reflejan el neto correcto, porque
las dos patas se aplicaron con signos opuestos.

---

## 5. Criterios de aceptación

Verificables a mano en la app corriendo, con una cuenta ARS y una USD:

1. Una transferencia de $100.000 entre dos cuentas propias no cambia
   "Ingresos" ni "Gastos" del mes en el dashboard ni en Reportes.
2. Esa transferencia aparece una sola vez en Movimientos, con el tipo
   "Transfer", y el filtro por tipo "Transfer" la encuentra.
3. Dos transferencias el mismo día entre las mismas dos cuentas: borrar una deja
   la otra intacta y los saldos correctos.
4. Una compra en 6 cuotas aparece 6 veces (no 7), y el gasto del mes sube solo
   por la cuota vencida.
5. Borrar esa compra en cuotas deja el saldo de la cuenta en el valor que tenía
   antes de crearla.
6. Con rates cargados, el patrimonio neto de una cuenta con 100 USD y otra con
   100.000 ARS es la suma convertida, no `100.100`.
7. Tocar "Registrar pago" dos veces seguidas registra un solo pago.
8. Un aporte de $50.000 a una meta baja $50.000 el saldo de la cuenta elegida y
   no aparece como gasto en el resumen del mes.
9. Cargar un gasto a las 22:00 hora Argentina lo fecha hoy, no mañana.
10. Desde el teléfono se llega a Metas, Suscripciones, Cuentas y Categorías.
11. Reportes arranca en "Este mes" y el cambio de período se refleja en la URL.
12. El toggle de tema cambia el tema al instante y sobrevive a un reload.
13. Navegar a Reportes muestra esqueletos, no la pantalla anterior congelada.

## 6. Fuera de alcance

Se dejan documentados sin implementar:

- Formato es-AR al tipear montos (`1.500,50`).
- Paginación / virtualización de la lista de movimientos (hoy trae 100 y filtra
  en el cliente).
- PWA: manifest, iconos, service worker.
- Etiquetas (tags) en transacciones — el esquema existe, la UI no.
- Concurrencia en el ajuste de saldos: sigue siendo read-modify-write sin
  transacción. Aceptable para un solo usuario; si dejara de serlo, mover el
  ajuste a una función Postgres con `security definer`.
