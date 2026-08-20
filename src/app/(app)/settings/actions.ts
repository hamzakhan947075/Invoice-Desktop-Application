"use server";

import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { businessProfileSchema } from "@/lib/validations/business";
import { getUploadsRoot } from "@/lib/uploads";
import { hashPin, verifyPin } from "@/lib/pin";

export type BusinessProfileActionState = { error?: string; success?: boolean } | undefined;

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * The browser-supplied MIME type is attacker-controlled — verify the file's
 * actual magic bytes match the claimed type rather than trusting it outright.
 */
function matchesDeclaredType(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/png") {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === "image/jpeg") {
    return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  }
  if (mimeType === "image/webp") {
    return (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

export async function updateBusinessProfileAction(
  _prevState: BusinessProfileActionState,
  formData: FormData
): Promise<BusinessProfileActionState> {
  // businessId always comes from the session, never from client input.
  const business = await requireCurrentBusiness();

  const parsed = businessProfileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    currency: formData.get("currency"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  let logoUrl = business.logoUrl;
  const logoFile = formData.get("logo");

  if (logoFile instanceof File && logoFile.size > 0) {
    if (!(logoFile.type in ALLOWED_LOGO_TYPES)) {
      return { error: "Logo must be a PNG, JPEG, or WEBP image." };
    }
    if (logoFile.size > MAX_LOGO_BYTES) {
      return { error: "Logo must be smaller than 2MB." };
    }

    const buffer = Buffer.from(await logoFile.arrayBuffer());
    if (!matchesDeclaredType(buffer, logoFile.type)) {
      return { error: "That file doesn't look like a valid image." };
    }

    const extension = ALLOWED_LOGO_TYPES[logoFile.type];
    const uploadDir = path.join(getUploadsRoot(), "businesses", business.id);
    await mkdir(uploadDir, { recursive: true });

    const filename = `logo-${randomUUID()}.${extension}`;
    await writeFile(path.join(uploadDir, filename), buffer);

    const previousLogoUrl = logoUrl;
    logoUrl = `/api/uploads/businesses/${business.id}/${filename}`;

    const previousPrefix = `/api/uploads/businesses/${business.id}/`;
    if (previousLogoUrl?.startsWith(previousPrefix)) {
      const previousPath = path.join(getUploadsRoot(), previousLogoUrl.slice("/api/uploads/".length));
      await unlink(previousPath).catch(() => {});
    }
  }

  await prisma.business.update({
    where: { id: business.id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      currency: parsed.data.currency,
      logoUrl,
    },
  });

  revalidatePath("/settings");
  return { success: true };
}

export type PinActionState = { error?: string; success?: boolean } | undefined;

const PIN_PATTERN = /^\d{4,8}$/;

export async function setPinAction(
  _prevState: PinActionState,
  formData: FormData
): Promise<PinActionState> {
  const business = await requireCurrentBusiness();
  const pin = formData.get("pin");
  const confirmPin = formData.get("confirmPin");

  if (typeof pin !== "string" || !PIN_PATTERN.test(pin)) {
    return { error: "PIN must be 4–8 digits." };
  }
  if (pin !== confirmPin) {
    return { error: "PINs don't match." };
  }

  await prisma.business.update({ where: { id: business.id }, data: { pinHash: hashPin(pin) } });
  revalidatePath("/settings");
  return { success: true };
}

export async function changePinAction(
  _prevState: PinActionState,
  formData: FormData
): Promise<PinActionState> {
  const business = await requireCurrentBusiness();
  const currentPin = formData.get("currentPin");
  const newPin = formData.get("newPin");
  const confirmPin = formData.get("confirmPin");

  if (!business.pinHash || typeof currentPin !== "string" || !verifyPin(currentPin, business.pinHash)) {
    return { error: "Current PIN is incorrect." };
  }
  if (typeof newPin !== "string" || !PIN_PATTERN.test(newPin)) {
    return { error: "New PIN must be 4–8 digits." };
  }
  if (newPin !== confirmPin) {
    return { error: "PINs don't match." };
  }

  await prisma.business.update({ where: { id: business.id }, data: { pinHash: hashPin(newPin) } });
  revalidatePath("/settings");
  return { success: true };
}

export async function removePinAction(
  _prevState: PinActionState,
  formData: FormData
): Promise<PinActionState> {
  const business = await requireCurrentBusiness();
  const currentPin = formData.get("currentPin");

  if (!business.pinHash || typeof currentPin !== "string" || !verifyPin(currentPin, business.pinHash)) {
    return { error: "Current PIN is incorrect." };
  }

  await prisma.business.update({ where: { id: business.id }, data: { pinHash: null } });
  revalidatePath("/settings");
  return { success: true };
}
