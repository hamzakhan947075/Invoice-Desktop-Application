import { Prisma } from "@/generated/prisma/client";

export type LineItemInput = {
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
};

export type LineItemTotals = {
  net: Prisma.Decimal;
  tax: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};

/**
 * Canonical per-line calculation, shared by invoice creation/editing and the
 * seed script. All money math happens with Prisma.Decimal — never floats.
 *
 *   net       = quantity * unitPrice - discount
 *   tax       = net * (taxRate / 100)
 *   lineTotal = net + tax
 */
export function calculateLineItem({ quantity, unitPrice, discount, taxRate }: LineItemInput): LineItemTotals {
  const gross = new Prisma.Decimal(quantity).times(unitPrice);
  const net = gross.minus(discount);
  const tax = net.times(taxRate).dividedBy(100);
  return { net, tax, lineTotal: net.plus(tax) };
}

export type InvoiceTotals = {
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  tax: Prisma.Decimal;
  total: Prisma.Decimal;
};

/**
 * Sums line items into invoice-level totals. `subtotal` is net of each
 * line's own discount but before tax; `total` = subtotal + tax.
 */
export function calculateInvoiceTotals(items: LineItemInput[]): InvoiceTotals {
  return items.reduce<InvoiceTotals>(
    (acc, item) => {
      const { net, tax } = calculateLineItem(item);
      return {
        subtotal: acc.subtotal.plus(net),
        discount: acc.discount.plus(item.discount),
        tax: acc.tax.plus(tax),
        total: acc.total.plus(net).plus(tax),
      };
    },
    {
      subtotal: new Prisma.Decimal(0),
      discount: new Prisma.Decimal(0),
      tax: new Prisma.Decimal(0),
      total: new Prisma.Decimal(0),
    }
  );
}

export type PaymentProgress = {
  amountPaid: Prisma.Decimal;
  balanceDue: Prisma.Decimal;
  isPaidInFull: boolean;
};

/** Applies a new payment amount to an invoice's running totals. */
export function applyPayment(
  total: Prisma.Decimal,
  previousAmountPaid: Prisma.Decimal,
  paymentAmount: Prisma.Decimal
): PaymentProgress {
  const amountPaid = previousAmountPaid.plus(paymentAmount);
  const balanceDue = total.minus(amountPaid);
  return {
    amountPaid,
    balanceDue: balanceDue.isNegative() ? new Prisma.Decimal(0) : balanceDue,
    isPaidInFull: balanceDue.lessThanOrEqualTo(0),
  };
}
