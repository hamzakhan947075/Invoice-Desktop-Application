import { describe, expect, it } from "vitest";
import { applyPayment, calculateInvoiceTotals, calculateLineItem } from "@/lib/invoice-calculations";
import { Prisma } from "@/generated/prisma/client";

describe("calculateLineItem", () => {
  it("computes net, tax, and line total for a simple line", () => {
    const result = calculateLineItem({ quantity: 2, unitPrice: 50000, discount: 0, taxRate: 0 });
    expect(result.net.toFixed(2)).toBe("100000.00");
    expect(result.tax.toFixed(2)).toBe("0.00");
    expect(result.lineTotal.toFixed(2)).toBe("100000.00");
  });

  it("applies a discount before computing tax", () => {
    const result = calculateLineItem({ quantity: 10, unitPrice: 3500, discount: 500, taxRate: 17 });
    // gross = 35000, net = 35000 - 500 = 34500, tax = 34500 * 0.17 = 5865
    expect(result.net.toFixed(2)).toBe("34500.00");
    expect(result.tax.toFixed(2)).toBe("5865.00");
    expect(result.lineTotal.toFixed(2)).toBe("40365.00");
  });

  it("supports fractional quantities", () => {
    const result = calculateLineItem({ quantity: 2.5, unitPrice: 100, discount: 0, taxRate: 0 });
    expect(result.net.toFixed(2)).toBe("250.00");
  });

  it("matches the seeded INV-2026-0002 fixture (10 x 3500 @ 17% tax, no discount)", () => {
    const result = calculateLineItem({ quantity: 10, unitPrice: 3500, discount: 0, taxRate: 17 });
    expect(result.net.toFixed(2)).toBe("35000.00");
    expect(result.tax.toFixed(2)).toBe("5950.00");
    expect(result.lineTotal.toFixed(2)).toBe("40950.00");
  });
});

describe("calculateInvoiceTotals", () => {
  it("sums multiple line items into invoice-level totals", () => {
    const totals = calculateInvoiceTotals([
      { quantity: 2, unitPrice: 50000, discount: 0, taxRate: 0 },
      { quantity: 1, unitPrice: 15000, discount: 0, taxRate: 0 },
    ]);
    expect(totals.subtotal.toFixed(2)).toBe("115000.00");
    expect(totals.discount.toFixed(2)).toBe("0.00");
    expect(totals.tax.toFixed(2)).toBe("0.00");
    expect(totals.total.toFixed(2)).toBe("115000.00");
  });

  it("aggregates discount and tax across items with mixed tax rates", () => {
    const totals = calculateInvoiceTotals([
      { quantity: 1, unitPrice: 1000, discount: 100, taxRate: 10 },
      { quantity: 1, unitPrice: 2000, discount: 0, taxRate: 5 },
    ]);
    // item 1: net = 900, tax = 90 -> line total 990
    // item 2: net = 2000, tax = 100 -> line total 2100
    expect(totals.subtotal.toFixed(2)).toBe("2900.00");
    expect(totals.discount.toFixed(2)).toBe("100.00");
    expect(totals.tax.toFixed(2)).toBe("190.00");
    expect(totals.total.toFixed(2)).toBe("3090.00");
  });

  it("returns all zeros for an empty item list", () => {
    const totals = calculateInvoiceTotals([]);
    expect(totals.subtotal.toFixed(2)).toBe("0.00");
    expect(totals.total.toFixed(2)).toBe("0.00");
  });
});

describe("applyPayment", () => {
  it("marks an invoice paid in full when the payment covers the balance exactly", () => {
    const total = new Prisma.Decimal("1000.00");
    const result = applyPayment(total, new Prisma.Decimal(0), new Prisma.Decimal("1000.00"));
    expect(result.amountPaid.toFixed(2)).toBe("1000.00");
    expect(result.balanceDue.toFixed(2)).toBe("0.00");
    expect(result.isPaidInFull).toBe(true);
  });

  it("computes a remaining balance for a partial payment", () => {
    const total = new Prisma.Decimal("40950.00");
    const result = applyPayment(total, new Prisma.Decimal(0), new Prisma.Decimal("20000.00"));
    expect(result.amountPaid.toFixed(2)).toBe("20000.00");
    expect(result.balanceDue.toFixed(2)).toBe("20950.00");
    expect(result.isPaidInFull).toBe(false);
  });

  it("accumulates across multiple payments", () => {
    const total = new Prisma.Decimal("1000.00");
    const afterFirst = applyPayment(total, new Prisma.Decimal(0), new Prisma.Decimal("400.00"));
    const afterSecond = applyPayment(total, afterFirst.amountPaid, new Prisma.Decimal("600.00"));
    expect(afterSecond.amountPaid.toFixed(2)).toBe("1000.00");
    expect(afterSecond.balanceDue.toFixed(2)).toBe("0.00");
    expect(afterSecond.isPaidInFull).toBe(true);
  });

  it("never returns a negative balance even if overpaid", () => {
    const total = new Prisma.Decimal("1000.00");
    const result = applyPayment(total, new Prisma.Decimal(0), new Prisma.Decimal("1200.00"));
    expect(result.balanceDue.toFixed(2)).toBe("0.00");
    expect(result.isPaidInFull).toBe(true);
  });
});
