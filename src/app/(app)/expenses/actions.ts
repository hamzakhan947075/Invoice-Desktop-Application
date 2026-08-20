"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { expenseSchema } from "@/lib/validations/expense";

export type ExpenseActionState = { error?: string; success?: boolean } | undefined;

function parseExpenseForm(formData: FormData) {
  return expenseSchema.safeParse({
    category: formData.get("category"),
    description: formData.get("description"),
    vendor: formData.get("vendor"),
    amount: formData.get("amount"),
    expenseDate: formData.get("expenseDate"),
    notes: formData.get("notes"),
  });
}

export async function createExpenseAction(
  _prevState: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  const business = await requireCurrentBusiness();
  const parsed = parseExpenseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await prisma.expense.create({
    data: {
      businessId: business.id,
      category: parsed.data.category,
      description: parsed.data.description,
      vendor: parsed.data.vendor || null,
      amount: parsed.data.amount.toFixed(2),
      expenseDate: new Date(parsed.data.expenseDate),
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath("/expenses");
  revalidatePath("/");
  return { success: true };
}

export async function updateExpenseAction(
  _prevState: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  const business = await requireCurrentBusiness();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Missing expense id." };
  }

  const parsed = parseExpenseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { count } = await prisma.expense.updateMany({
    where: { id, businessId: business.id },
    data: {
      category: parsed.data.category,
      description: parsed.data.description,
      vendor: parsed.data.vendor || null,
      amount: parsed.data.amount.toFixed(2),
      expenseDate: new Date(parsed.data.expenseDate),
      notes: parsed.data.notes || null,
    },
  });

  if (count === 0) {
    return { error: "Expense not found." };
  }

  revalidatePath("/expenses");
  revalidatePath("/");
  return { success: true };
}

export type DeleteExpenseActionState = { error?: string; success?: boolean } | undefined;

export async function deleteExpenseAction(
  _prevState: DeleteExpenseActionState,
  formData: FormData
): Promise<DeleteExpenseActionState> {
  const business = await requireCurrentBusiness();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Missing expense id." };
  }

  await prisma.expense.deleteMany({ where: { id, businessId: business.id } });
  revalidatePath("/expenses");
  revalidatePath("/");
  return { success: true };
}
