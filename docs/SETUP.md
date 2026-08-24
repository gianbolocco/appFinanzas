# Setup Supabase + OAuth — Guita

Guía para conectar el proyecto a Supabase y probar el flujo auth → onboarding → dashboard.

---

## 1. Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) y loguearse (GitHub/Google).
2. **New project** → nombre: `guita` → región: **South America (São Paulo)** → password fuerte para la DB.
3. Esperar ~2 min a que termine el provisioning.

## 2. Obtener claves del proyecto

En el dashboard → **Project Settings** (⚙️) → **API**:

| Variable | Dónde está |
|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | "Project URL" |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | "anon public" key |
| `SUPABASE_SERVICE_ROLE_KEY` | "service_role" key (solo server) |

Anotar las tres.

## 3. Ejecutar la migración (esquema + RLS + seed)

**Opción A — SQL Editor (más simple):**
1. Dashboard → **SQL Editor** → **New query**.
2. Abrir `supabase/migrations/0001_init_schema.sql` del repo, copiar todo, pegar.
3. **Run**. Debería ejecutarse sin errores.

**Opción B — Supabase CLI:**
```bash
npm i -g supabase
supabase login
supabase link --project-ref <TU-PROJECT-REF>
supabase db push
```

## 4. Configurar OAuth — Google

1. Ir a [Google Cloud Console](https://console.cloud.google.com) → crear proyecto (o usar uno existente).
2. **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**.
   - Tipo: **Web application**
   - Nombre: `Guita`
   - **Authorized JavaScript origins:**
     - `http://localhost:3000`
     - (futuro) `https://guita.vercel.app`
   - **Authorized redirect URIs:**
     - `https://<TU-PROJECT-REF>.supabase.co/auth/v1/callback`
3. Copiar el **Client ID** y **Client Secret**.
4. Volver al dashboard de Supabase → **Authentication** → **Providers** → **Google**:
   - **Enable**
   - Pegar Client ID y Client Secret
   - **Save**

## 5. Configurar OAuth — Apple (opcional para local)

> ⚠️ Apple requiere cuenta de Apple Developer ($99/año). Si no tenés, salteá esto y usá solo Google.

1. [Apple Developer](https://developer.apple.com) → **Certificates, Identifiers & Profiles**.
2. **Identifiers** → **Services ID** (no App ID):
   - Descripción: `Guita Web`
   - **Sign In with Apple** → Configure:
     - Primary App ID: crear uno nuevo (com.guita.web)
     - **Return URLs:** `https://<TU-PROJECT-REF>.supabase.co/auth/v1/callback`
3. Crear una **Key** con "Sign In with Apple" habilitado → descargar `.p8`.
4. Supabase → **Authentication** → **Providers** → **Apple**:
   - **Enable**
   - Service ID, Team ID, Key ID, subir el `.p8`
   - **Save**

## 6. Configurar URLs de redirección en Supabase

Dashboard → **Authentication** → **URL Configuration**:

- **Site URL:** `http://localhost:3000`
- **Redirect URLs:**
  - `http://localhost:3000/auth/callback`
  - (futuro) `https://guita.vercel.app/auth/callback`

## 7. Llenar `.env.local`

En `apps/web/`, copiar `.env.example` a `.env.local` y completar:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<TU-PROJECT-REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...   # anon key
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...        # service role (server only)

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Las demás vars (OpenAI, Telegram, exchange rates) se usan en fases posteriores.

## 8. Probar

```bash
pnpm dev
```

1. Abrir `http://localhost:3000` → debería redirigir a `/login`.
2. Tocar **Continuar con Google** → flujo OAuth → vuelve a `/auth/callback` → redirige a `/onboarding`.
3. Completar los 3 pasos (nombre → moneda ARS → Efectivo) → llega al `/dashboard`.
4. Verificar en Supabase → **Table Editor** → `users`: debería tener tu fila con `onboarded = true`.
5. Verificar `accounts`: debería tener la fila "Efectivo".

## 9. Problemas comunes

| Síntoma | Causa probable |
|---------|---------------|
| `Invalid API key` | URL o anon key mal copiadas en `.env.local` |
| OAuth redirige pero vuelve a login | Redirect URIs mal configuradas en Supabase (paso 6) |
| `redirect_uri_mismatch` (Google) | La URI de callback de Supabase no está en Google Console |
| Loop login ↔ dashboard | Sesión no se setea — verificar que `@supabase/ssr` cookies funcionen |
| Perfil no se crea | El trigger `on_auth_user_created` falló — ver Supabase logs |
| 404 en `/auth/callback` | La ruta existe — revisar consola del navegador |

## 10. Desconectar sesión (para probar de nuevo)

Por ahora no hay botón de logout (va en Fase 3/7). Para resetear:
- Borrar cookies del sitio en el navegador, o
- Supabase → **Authentication** → **Users** → eliminar tu usuario, o
- Supabase → SQL Editor: `delete from public.users where id = '<tu-id>';` + `delete from auth.users where id = '<tu-id>';`

## 11. Cotizaciones automáticas

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
4. Ejecutar `supabase/migrations/0007_exchange_rates_cron.sql`.
5. Verificar: `select * from cron.job where jobname = 'exchange-rates-daily';`

Sin este paso los totales multi-moneda del dashboard aparecen marcados como
incompletos, que es el comportamiento correcto: no inventan un número.
