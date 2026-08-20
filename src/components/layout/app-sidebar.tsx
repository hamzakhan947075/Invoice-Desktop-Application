import Link from "next/link";
import { Receipt } from "lucide-react";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export function AppSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 px-6">
        <Link href="/" className="flex items-center gap-2 font-heading font-semibold text-sidebar-foreground">
          <Receipt className="h-5 w-5 text-primary" />
          InvoiceFlow
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <SidebarNav />
      </div>
    </aside>
  );
}
