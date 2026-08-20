"use client";

import Link from "next/link";
import { Download, Eye, FileText, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { InvoiceStatus } from "@/generated/prisma/enums";

export function InvoiceRowActions({
  invoiceId,
  invoiceNumber,
  status,
  onRequestDelete,
}: {
  invoiceId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  onRequestDelete: () => void;
}) {
  const canEdit = status === "DRAFT";
  const canDelete = status === "DRAFT";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${invoiceNumber}`}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/invoices/${invoiceId}`}>
            <Eye className="h-4 w-4" />
            View
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`/invoices/${invoiceId}/pdf?disposition=inline`} target="_blank" rel="noopener noreferrer">
            <FileText className="h-4 w-4" />
            View PDF
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`/invoices/${invoiceId}/pdf`} download={`${invoiceNumber}.pdf`}>
            <Download className="h-4 w-4" />
            Download PDF
          </a>
        </DropdownMenuItem>

        {canEdit && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/invoices/${invoiceId}/edit`}>
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            </DropdownMenuItem>
          </>
        )}

        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onRequestDelete}>
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
