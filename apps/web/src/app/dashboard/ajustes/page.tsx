import { getCurrentUser } from "@/lib/dal";
import { LogoutButton } from "./logout-button";

export default async function AjustesPage() {
  const { profile } = await getCurrentUser();

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold lg:text-2xl">Ajustes</h1>
      </header>

      <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground">Nombre</span>
          <span className="text-sm font-medium">{profile.full_name ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-t border-border">
          <span className="text-sm text-muted-foreground">Email</span>
          <span className="text-sm font-medium">{profile.email}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-t border-border">
          <span className="text-sm text-muted-foreground">Moneda base</span>
          <span className="text-sm font-medium">{profile.base_currency}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-t border-border">
          <span className="text-sm text-muted-foreground">Idioma</span>
          <span className="text-sm font-medium">{profile.locale}</span>
        </div>
      </section>

      <LogoutButton />
    </div>
  );
}
