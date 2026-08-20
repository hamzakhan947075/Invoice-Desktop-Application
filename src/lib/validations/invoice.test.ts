import { describe, expect, it } from "vitest";
import { invoiceSchema, type InvoiceInput } from "@/lib/validations/invoice";

function baseInvoice(overrides: Partial<InvoiceInput> = {}): InvoiceInput {
  return {
    customerId: "customer-1",
    issueDate: "2026-08-01",
    dueDate: "2026-08-15",
    currency: "PKR",
    notes: "",
    items: [{ productId: "", description: "Design work", quantity: 1, unitPrice: 1000, discount: 0, taxRate: 0 }],
    ...overrides,
  };
}

describe("invoiceSchema", () => {
  it("accepts a valid invoice", () => {
    expect(invoiceSchema.safeParse(baseInvoice()).success).toBe(true);
  });

  it("rejects an invoice with no items", () => {
    const result = invoiceSchema.safeParse(baseInvoice({ items: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects a due date before the issue date", () => {
    const result = invoiceSchema.safeParse(
      baseInvoice({ issueDate: "2026-08-15", dueDate: "2026-08-01" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a missing customer", () => {
    const result = invoiceSchema.safeParse(baseInvoice({ customerId: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects a line item discount larger than the line's gross amount", () => {
    const result = invoiceSchema.safeParse(
      baseInvoice({
        items: [{ productId: "", description: "Item", quantity: 1, unitPrice: 100, discount: 150, taxRate: 0 }],
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a negative or zero quantity", () => {
    const result = invoiceSchema.safeParse(
      baseInvoice({
        items: [{ productId: "", description: "Item", quantity: 0, unitPrice: 100, discount: 0, taxRate: 0 }],
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a tax rate over 100%", () => {
    const result = invoiceSchema.safeParse(
      baseInvoice({
        items: [{ productId: "", description: "Item", quantity: 1, unitPrice: 100, discount: 0, taxRate: 150 }],
      })
    );
    expect(result.success).toBe(false);
  });
});
