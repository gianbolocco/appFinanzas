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
