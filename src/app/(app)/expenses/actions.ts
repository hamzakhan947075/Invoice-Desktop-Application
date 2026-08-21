"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { expenseSchema } from "@/lib/validations/expense";
import { logActivity, diffFields } from "@/lib/activity-log";

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

  const expense = await prisma.expense.create({
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

  await logActivity(prisma, {
    businessId: business.id,
    action: "expense.created",
    entityType: "Expense",
    entityId: expense.id,
    summary: `Recorded expense "${expense.description}" (${expense.amount.toFixed(2)})`,
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

  const before = await prisma.expense.findFirst({
    where: { id, businessId: business.id },
    select: { description: true, amount: true, category: true },
  });
  if (!before) return { error: "Expense not found." };

  const after = {
    category: parsed.data.category,
    description: parsed.data.description,
    vendor: parsed.data.vendor || null,
    amount: parsed.data.amount.toFixed(2),
    expenseDate: new Date(parsed.data.expenseDate),
    notes: parsed.data.notes || null,
  };
  const { count } = await prisma.expense.updateMany({
    where: { id, businessId: business.id },
    data: after,
  });

  if (count === 0) {
    return { error: "Expense not found." };
  }

  await logActivity(prisma, {
    businessId: business.id,
    action: "expense.updated",
    entityType: "Expense",
    entityId: id,
    summary: `Updated expense "${after.description}"`,
    changes: diffFields(
      { description: before.description, amount: before.amount.toFixed(2), category: before.category },
      { description: after.description, amount: after.amount, category: after.category }
    ),
  });

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

  const expense = await prisma.expense.findFirst({ where: { id, businessId: business.id }, select: { id: true, description: true } });

  await prisma.expense.deleteMany({ where: { id, businessId: business.id } });

  if (expense) {
    await logActivity(prisma, {
      businessId: business.id,
      action: "expense.deleted",
      entityType: "Expense",
      entityId: expense.id,
      summary: `Deleted expense "${expense.description}"`,
    });
  }

  revalidatePath("/expenses");
  revalidatePath("/");
  return { success: true };
}
