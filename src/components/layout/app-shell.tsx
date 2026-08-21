import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { PageTransition } from "@/components/layout/page-transition";
import { CommandPalette } from "@/components/layout/command-palette";

export function AppShell({
  children,
  businessName,
}: {
  children: React.ReactNode;
  businessName: string;
}) {
  return (
    <div className="flex min-h-svh">
      <div className="print:hidden">
        <AppSidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="print:hidden">
          <AppHeader businessName={businessName} />
        </div>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 print:overflow-visible print:p-0">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
