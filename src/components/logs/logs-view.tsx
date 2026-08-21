"use client";

import { useRouter, usePathname } from "next/navigation";
import { History } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";

export type LogEntryRow = {
  id: string;
  action: string;
  entityType: string;
  summary: string;
  changes: { field: string; from: unknown; to: unknown }[] | null;
  createdAt: string;
};

const ENTITY_LABELS: Record<string, string> = {
  CreditNote: "Credit Note",
  RecurringInvoice: "Recurring Invoice",
};

function entityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export function LogsView({
  entries,
  entityTypes,
  filters,
  truncated,
}: {
  entries: LogEntryRow[];
  entityTypes: string[];
  filters: { q: string; type: string };
  truncated: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname);
  }

  const hasFilters = Boolean(filters.q || filters.type);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <SearchInput placeholder="Search activity…" defaultValue={filters.q} />

        <Select value={filters.type || "ALL"} onValueChange={(value) => updateParam("type", value === "ALL" ? "" : value)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {entityTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {entityLabel(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Date &amp; Time</TableHead>
              <TableHead className="w-36">Type</TableHead>
              <TableHead>What happened</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="p-0">
                  <EmptyState
                    icon={History}
                    title={hasFilters ? "No activity matches your filters" : "No activity yet"}
                    description={
                      hasFilters
                        ? "Try a different search term or type."
                        : "Actions you take across the app — creating, editing, deleting, status changes — will show up here."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{entityLabel(entry.entityType)}</Badge>
                  </TableCell>
                  <TableCell>
                    <p>{entry.summary}</p>
                    {entry.changes && entry.changes.length > 0 && (
                      <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                        {entry.changes.map((change, index) => (
                          <li key={index}>
                            <span className="font-medium">{change.field}</span>:{" "}
                            {formatFieldValue(change.from)} → {formatFieldValue(change.to)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {truncated && (
        <p className="text-sm text-muted-foreground">
          Showing the most recent {entries.length} entries. Narrow your search to see older activity.
        </p>
      )}
    </div>
  );
}
