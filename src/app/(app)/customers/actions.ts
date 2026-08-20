"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { customerSchema } from "@/lib/validations/customer";

export type CustomerActionState = { error?: string; success?: boolean } | undefined;

function parseCustomerForm(formData: FormData) {
  return customerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    notes: formData.get("notes"),
  });
}

export async function createCustomerAction(
  _prevState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const business = await requireCurrentBusiness();
  const parsed = parseCustomerForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await prisma.customer.create({
    data: {
      businessId: business.id,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath("/customers");
  return { success: true };
}

export async function updateCustomerAction(
  _prevState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const business = await requireCurrentBusiness();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Missing customer id." };
  }

  const parsed = parseCustomerForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Scoped by businessId, not just id — a customer belonging to another
  // business must never be editable, even if its id is guessed.
  const { count } = await prisma.customer.updateMany({
    where: { id, businessId: business.id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
    },
  });

  if (count === 0) {
    return { error: "Customer not found." };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { success: true };
}

export type DeleteCustomerActionState = { error?: string; success?: boolean } | undefined;

export async function deleteCustomerAction(
  _prevState: DeleteCustomerActionState,
  formData: FormData
): Promise<DeleteCustomerActionState> {
  const business = await requireCurrentBusiness();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Missing customer id." };
  }

  const customer = await prisma.customer.findFirst({
    where: { id, businessId: business.id },
    select: { id: true, _count: { select: { invoices: true } } },
  });

  if (!customer) {
    return { error: "Customer not found." };
  }
  if (customer._count.invoices > 0) {
    return { error: "This customer has invoices and can't be deleted." };
  }

  await prisma.customer.update({ where: { id: customer.id }, data: { deletedAt: new Date() } });
  revalidatePath("/customers");
  revalidatePath("/trash");
  return { success: true };
}

export async function restoreCustomerAction(id: string): Promise<{ error?: string }> {
  const business = await requireCurrentBusiness();
  const { count } = await prisma.customer.updateMany({
    where: { id, businessId: business.id, deletedAt: { not: null } },
    data: { deletedAt: null },
  });
  if (count === 0) return { error: "Customer not found in trash." };
  revalidatePath("/customers");
  revalidatePath("/trash");
  return {};
}

export async function purgeCustomerAction(id: string): Promise<{ error?: string }> {
  const business = await requireCurrentBusiness();
  const customer = await prisma.customer.findFirst({
    where: { id, businessId: business.id, deletedAt: { not: null } },
    select: { id: true },
  });
  if (!customer) return { error: "Customer not found in trash." };
  await prisma.customer.delete({ where: { id: customer.id } });
  revalidatePath("/trash");
  return {};
}
