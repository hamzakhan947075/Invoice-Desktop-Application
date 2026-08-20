import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Users,
  Package,
  Wallet,
  Repeat,
  Receipt,
  Undo2,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "Quotes", href: "/quotes", icon: ClipboardList },
  { label: "Recurring", href: "/recurring-invoices", icon: Repeat },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Products", href: "/products", icon: Package },
  { label: "Expenses", href: "/expenses", icon: Receipt },
  { label: "Payments", href: "/payments", icon: Wallet },
  { label: "Credit Notes", href: "/credit-notes", icon: Undo2 },
  { label: "Settings", href: "/settings", icon: Settings },
];
