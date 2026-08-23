import { BottomNav } from "@/components/bottom-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col">
      <main className="flex flex-1 flex-col px-5 pb-28 pt-8">{children}</main>
      <BottomNav />
    </div>
  );
}
