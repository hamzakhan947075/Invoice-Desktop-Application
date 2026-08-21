"use client";

import Link from "next/link";
import { Download, FileText, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  const iconButtonClass = "rounded-full";

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button variant="outline" size="icon-sm" className={iconButtonClass} asChild title={`View PDF for ${invoiceNumber}`}>
        <a href={`/invoices/${invoiceId}/pdf?disposition=inline`} target="_blank" rel="noopener noreferrer">
          <FileText className="h-4 w-4" />
          <span className="sr-only">View PDF</span>
        </a>
      </Button>
      <Button variant="outline" size="icon-sm" className={iconButtonClass} asChild title={`Download PDF for ${invoiceNumber}`}>
        <a href={`/invoices/${invoiceId}/pdf`} download={`${invoiceNumber}.pdf`}>
          <Download className="h-4 w-4" />
          <span className="sr-only">Download PDF</span>
        </a>
      </Button>
      {canEdit && (
        <Button variant="outline" size="icon-sm" className={iconButtonClass} asChild title={`Edit ${invoiceNumber}`}>
          <Link href={`/invoices/${invoiceId}/edit`}>
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit</span>
          </Link>
        </Button>
      )}
      <Button
        variant="outline"
        size="icon-sm"
        className={iconButtonClass}
        title={`Delete ${invoiceNumber}`}
        onClick={onRequestDelete}
      >
        <Trash2 className="h-4 w-4" />
        <span className="sr-only">Delete</span>
      </Button>
    </div>
  );
}
