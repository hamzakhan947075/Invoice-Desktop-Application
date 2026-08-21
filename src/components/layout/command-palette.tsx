"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, ClipboardList, Users, Package, Plus, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { navItems } from "@/lib/nav-items";
import { formatMoney } from "@/lib/format";

type ResultItem = {
  key: string;
  label: string;
  sublabel?: string;
  href: string;
  icon: LucideIcon;
  group: string;
};

type SearchResponse = {
  invoices: { id: string; invoiceNumber: string; customerName: string; total: string; currency: string }[];
  quotes: { id: string; quoteNumber: string; customerName: string; total: string; currency: string }[];
  customers: { id: string; name: string; email: string | null }[];
  products: { id: string; name: string; sku: string | null; price: string }[];
};

const STATIC_COMMANDS: ResultItem[] = [
  { key: "new-invoice", label: "New Invoice", href: "/invoices/new", icon: Plus, group: "Create" },
  { key: "new-quote", label: "New Quote", href: "/quotes/new", icon: Plus, group: "Create" },
  {
    key: "new-recurring",
    label: "New Recurring Invoice",
    href: "/recurring-invoices/new",
    icon: Plus,
    group: "Create",
  },
  ...navItems.map((item) => ({
    key: `go-${item.href}`,
    label: `Go to ${item.label}`,
    href: item.href,
    icon: item.icon,
    group: "Navigate",
  })),
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Every path that opens/closes the palette routes through here, so the
  // "clear state on close" logic lives in one event-driven place instead of
  // an effect that watches `open` and calls setState synchronously.
  const setOpenState = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setResults(null);
      setSelectedIndex(0);
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpenState(true);
      }
    }
    // The header's search button can't reach this component's state directly
    // without prop-drilling through the whole shell, so it opens the palette
    // via this event instead.
    function handleOpenEvent() {
      setOpenState(true);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("invoiceflow:open-command-palette", handleOpenEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("invoiceflow:open-command-palette", handleOpenEvent);
    };
  }, [setOpenState]);

  useEffect(() => {
    if (!open || !query.trim()) return;
    const handle = setTimeout(async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      if (response.ok) setResults(await response.json());
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open]);

  const items = useMemo<ResultItem[]>(() => {
    const trimmed = query.trim().toLowerCase();
    const commands = trimmed
      ? STATIC_COMMANDS.filter((c) => c.label.toLowerCase().includes(trimmed))
      : STATIC_COMMANDS.filter((c) => c.group === "Create");

    if (!trimmed || !results) return commands;

    const invoiceItems: ResultItem[] = results.invoices.map((i) => ({
      key: `invoice-${i.id}`,
      label: i.invoiceNumber,
      sublabel: `${i.customerName} · ${formatMoney(i.total, i.currency)}`,
      href: `/invoices/${i.id}`,
      icon: FileText,
      group: "Invoices",
    }));
    const quoteItems: ResultItem[] = results.quotes.map((q) => ({
      key: `quote-${q.id}`,
      label: q.quoteNumber,
      sublabel: `${q.customerName} · ${formatMoney(q.total, q.currency)}`,
      href: `/quotes/${q.id}`,
      icon: ClipboardList,
      group: "Quotes",
    }));
    const customerItems: ResultItem[] = results.customers.map((c) => ({
      key: `customer-${c.id}`,
      label: c.name,
      sublabel: c.email ?? undefined,
      href: `/customers/${c.id}`,
      icon: Users,
      group: "Customers",
    }));
    const productItems: ResultItem[] = results.products.map((p) => ({
      key: `product-${p.id}`,
      label: p.name,
      sublabel: p.sku ?? undefined,
      href: "/products",
      icon: Package,
      group: "Products",
    }));

    return [...commands, ...invoiceItems, ...quoteItems, ...customerItems, ...productItems];
  }, [query, results]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedIndex(0);
  }

  const activate = useCallback(
    (item: ResultItem) => {
      setOpen(false);
      router.push(item.href);
    },
    [router]
  );

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = items[selectedIndex];
      if (item) activate(item);
    }
  }

  let runningIndex = -1;
  const groups = new Map<string, ResultItem[]>();
  for (const item of items) {
    const list = groups.get(item.group) ?? [];
    list.push(item);
    groups.set(item.group, list);
  }

  return (
    <Dialog open={open} onOpenChange={setOpenState}>
      <DialogContent
        showCloseButton={false}
        className="top-[20%] max-w-lg translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search invoices, quotes, customers, products…"
            className="border-none shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No results.</p>
          ) : (
            Array.from(groups.entries()).map(([group, groupItems]) => (
              <div key={group} className="mb-2 last:mb-0">
                <p className="px-2 py-1 text-xs font-medium text-muted-foreground">{group}</p>
                {groupItems.map((item) => {
                  runningIndex += 1;
                  const isSelected = runningIndex === selectedIndex;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onMouseEnter={() => setSelectedIndex(runningIndex)}
                      onClick={() => activate(item)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                        isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                      }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.sublabel && (
                        <span className="shrink-0 truncate text-xs text-muted-foreground">{item.sublabel}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
