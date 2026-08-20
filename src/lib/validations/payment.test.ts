import { describe, expect, it } from "vitest";
import { paymentSchema } from "@/lib/validations/payment";

describe("paymentSchema", () => {
  it("accepts a valid payment", () => {
    const result = paymentSchema.safeParse({
      amount: 500,
      paymentDate: "2026-08-01",
      paymentMethod: "BANK_TRANSFER",
      reference: "TXN-1",
      notes: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a zero or negative amount", () => {
    expect(
      paymentSchema.safeParse({
        amount: 0,
        paymentDate: "2026-08-01",
        paymentMethod: "CASH",
      }).success
    ).toBe(false);

    expect(
      paymentSchema.safeParse({
        amount: -50,
        paymentDate: "2026-08-01",
        paymentMethod: "CASH",
      }).success
    ).toBe(false);
  });

  it("rejects an invalid payment method", () => {
    const result = paymentSchema.safeParse({
      amount: 100,
      paymentDate: "2026-08-01",
      paymentMethod: "BITCOIN",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing payment date", () => {
    const result = paymentSchema.safeParse({
      amount: 100,
      paymentDate: "",
      paymentMethod: "CASH",
    });
    expect(result.success).toBe(false);
  });
});
