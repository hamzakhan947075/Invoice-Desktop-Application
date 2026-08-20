import { describe, expect, it } from "vitest";
import { getEffectiveInvoiceStatus, invoiceStatusWhere } from "@/lib/invoice-status";

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

describe("getEffectiveInvoiceStatus", () => {
  it("returns DRAFT as-is regardless of due date", () => {
    const status = getEffectiveInvoiceStatus({
      status: "DRAFT",
      dueDate: daysFromNow(-30),
      balanceDue: "500.00",
    });
    expect(status).toBe("DRAFT");
  });

  it("returns PAID as-is even if the due date has passed", () => {
    const status = getEffectiveInvoiceStatus({
      status: "PAID",
      dueDate: daysFromNow(-10),
      balanceDue: "0.00",
    });
    expect(status).toBe("PAID");
  });

  it("returns CANCELLED as-is", () => {
    const status = getEffectiveInvoiceStatus({
      status: "CANCELLED",
      dueDate: daysFromNow(-10),
      balanceDue: "500.00",
    });
    expect(status).toBe("CANCELLED");
  });

  it("derives OVERDUE for a SENT invoice past its due date with a balance remaining", () => {
    const status = getEffectiveInvoiceStatus({
      status: "SENT",
      dueDate: daysFromNow(-1),
      balanceDue: "500.00",
    });
    expect(status).toBe("OVERDUE");
  });

  it("derives OVERDUE for a PARTIALLY_PAID invoice past due with a balance remaining", () => {
    const status = getEffectiveInvoiceStatus({
      status: "PARTIALLY_PAID",
      dueDate: daysFromNow(-1),
      balanceDue: "500.00",
    });
    expect(status).toBe("OVERDUE");
  });

  it("does NOT mark a SENT invoice overdue if the due date hasn't passed yet", () => {
    const status = getEffectiveInvoiceStatus({
      status: "SENT",
      dueDate: daysFromNow(5),
      balanceDue: "500.00",
    });
    expect(status).toBe("SENT");
  });

  it("does NOT mark a SENT invoice overdue if the balance is fully paid", () => {
    const status = getEffectiveInvoiceStatus({
      status: "SENT",
      dueDate: daysFromNow(-5),
      balanceDue: "0.00",
    });
    expect(status).toBe("SENT");
  });
});

describe("invoiceStatusWhere", () => {
  it("returns an empty filter for ALL", () => {
    expect(invoiceStatusWhere("ALL")).toEqual({});
  });

  it("returns a straightforward equality filter for PAID (never overdue)", () => {
    expect(invoiceStatusWhere("PAID")).toEqual({ status: "PAID" });
  });

  it("builds a filter for OVERDUE matching both a manually-set status and the due-date derivation", () => {
    const where = invoiceStatusWhere("OVERDUE") as {
      OR: [{ status: string }, { status: { in: string[] }; dueDate: { lt: Date }; balanceDue: { gt: number } }];
    };
    expect(where.OR[0]).toEqual({ status: "OVERDUE" });
    expect(where.OR[1].status.in).toEqual(["SENT", "PARTIALLY_PAID"]);
    expect(where.OR[1].balanceDue).toEqual({ gt: 0 });
    expect(where.OR[1].dueDate.lt).toBeInstanceOf(Date);
  });

  it("excludes overdue invoices when filtering explicitly for SENT", () => {
    const where = invoiceStatusWhere("SENT") as { status: string; OR: unknown[] };
    expect(where.status).toBe("SENT");
    expect(where.OR).toBeDefined();
  });
});
