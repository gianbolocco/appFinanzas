import { BottomNav } from "@/components/bottom-nav";
import { Sidebar } from "@/components/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh w-full">
      <Sidebar />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col lg:max-w-4xl">
        <main className="flex flex-1 flex-col px-5 pb-28 pt-8 lg:px-8 lg:pb-12 lg:pt-10">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
