"use server";

import { mkdir, unlink, writeFile, rm } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { requireCurrentBusiness, PLACEHOLDER_BUSINESS_NAME } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { businessProfileSchema } from "@/lib/validations/business";
import { getUploadsRoot } from "@/lib/uploads";
import { hashPin, verifyPin, hashRecoveryAnswer, PIN_PATTERN } from "@/lib/pin";
import { logActivity, diffFields } from "@/lib/activity-log";
import { FLUSH_CONFIRMATION_PHRASE } from "@/lib/danger-zone";

export type BusinessProfileActionState = { error?: string; success?: boolean } | undefined;

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
// Accepted on upload, but always re-encoded to PNG below before being
// written to disk — @react-pdf/renderer (the invoice/quote/statement PDF
// engine) can only decode PNG/JPEG/SVG, so a WEBP or GIF logo would upload
// fine and display fine in the app itself (the browser renders those
// natively), but silently fail to appear in any generated PDF. Normalizing
// to one format here means it can never matter what the user uploads.
const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

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
  if (mimeType === "image/gif") {
    const header = buffer.subarray(0, 6).toString("ascii");
    return header === "GIF87a" || header === "GIF89a";
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
    if (!ALLOWED_LOGO_TYPES.has(logoFile.type)) {
      return { error: "Logo must be a PNG, JPEG, WEBP, or GIF image." };
    }
    if (logoFile.size > MAX_LOGO_BYTES) {
      return { error: "Logo must be smaller than 2MB." };
    }

    const rawBuffer = Buffer.from(await logoFile.arrayBuffer());
    if (!matchesDeclaredType(rawBuffer, logoFile.type)) {
      return { error: "That file doesn't look like a valid image." };
    }

    let buffer: Buffer;
    try {
      // Always re-encoded to PNG regardless of the input format, so the
      // stored file is guaranteed to render in generated PDFs later.
      buffer = await sharp(rawBuffer).png().toBuffer();
    } catch {
      return { error: "That image couldn't be processed. Try a different file." };
    }

    const uploadDir = path.join(getUploadsRoot(), "businesses", business.id);
    await mkdir(uploadDir, { recursive: true });

    const filename = `logo-${randomUUID()}.png`;
    await writeFile(path.join(uploadDir, filename), buffer);

    const previousLogoUrl = logoUrl;
    logoUrl = `/api/uploads/businesses/${business.id}/${filename}`;

    const previousPrefix = `/api/uploads/businesses/${business.id}/`;
    if (previousLogoUrl?.startsWith(previousPrefix)) {
      const previousPath = path.join(getUploadsRoot(), previousLogoUrl.slice("/api/uploads/".length));
      await unlink(previousPath).catch(() => {});
    }
  }

  const after = {
    name: parsed.data.name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    address: parsed.data.address || null,
    currency: parsed.data.currency,
    logoUrl,
  };
  await prisma.business.update({
    where: { id: business.id },
    data: after,
  });

  await logActivity(prisma, {
    businessId: business.id,
    action: "business.updated",
    entityType: "Business",
    entityId: business.id,
    summary: "Updated business profile settings",
    changes: diffFields(
      {
        name: business.name,
        email: business.email,
        phone: business.phone,
        address: business.address,
        currency: business.currency,
        logoUrl: business.logoUrl,
      },
      after
    ),
  });

  revalidatePath("/settings");
  return { success: true };
}

export type PinActionState = { error?: string; success?: boolean } | undefined;

function parseRecoveryFields(formData: FormData): { question: string; answer: string } | { error: string } {
  const recoveryQuestion = formData.get("recoveryQuestion");
  const recoveryAnswer = formData.get("recoveryAnswer");
  const question = typeof recoveryQuestion === "string" ? recoveryQuestion.trim() : "";
  const answer = typeof recoveryAnswer === "string" ? recoveryAnswer.trim() : "";

  if (question.length < 3) {
    return { error: "Recovery question must be at least 3 characters." };
  }
  if (answer.length < 2) {
    return { error: "Recovery answer must be at least 2 characters." };
  }
  return { question, answer };
}

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

  // A recovery question is required, not optional, when setting a PIN —
  // otherwise a forgotten PIN has no way back short of editing the database.
  const recovery = parseRecoveryFields(formData);
  if ("error" in recovery) return recovery;

  await prisma.business.update({
    where: { id: business.id },
    data: {
      pinHash: hashPin(pin),
      pinRecoveryQuestion: recovery.question,
      pinRecoveryAnswerHash: hashRecoveryAnswer(recovery.answer),
    },
  });
  await logActivity(prisma, {
    businessId: business.id,
    action: "business.pin_set",
    entityType: "Business",
    entityId: business.id,
    summary: "Set a screen-lock PIN",
  });
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

  // Recovery question/answer are optional here — leave the existing ones in
  // place unless the user filled in new ones.
  const recoveryQuestionRaw = formData.get("recoveryQuestion");
  const recoveryAnswerRaw = formData.get("recoveryAnswer");
  const hasNewRecovery =
    typeof recoveryQuestionRaw === "string" &&
    recoveryQuestionRaw.trim() &&
    typeof recoveryAnswerRaw === "string" &&
    recoveryAnswerRaw.trim();

  let recoveryUpdate: { pinRecoveryQuestion: string; pinRecoveryAnswerHash: string } | Record<string, never> = {};
  if (hasNewRecovery) {
    const recovery = parseRecoveryFields(formData);
    if ("error" in recovery) return recovery;
    recoveryUpdate = {
      pinRecoveryQuestion: recovery.question,
      pinRecoveryAnswerHash: hashRecoveryAnswer(recovery.answer),
    };
  }

  await prisma.business.update({
    where: { id: business.id },
    data: { pinHash: hashPin(newPin), ...recoveryUpdate },
  });
  await logActivity(prisma, {
    businessId: business.id,
    action: "business.pin_changed",
    entityType: "Business",
    entityId: business.id,
    summary: "Changed the screen-lock PIN",
  });
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

  await prisma.business.update({
    where: { id: business.id },
    data: { pinHash: null, pinRecoveryQuestion: null, pinRecoveryAnswerHash: null },
  });
  await logActivity(prisma, {
    businessId: business.id,
    action: "business.pin_removed",
    entityType: "Business",
    entityId: business.id,
    summary: "Removed the screen-lock PIN",
  });
  revalidatePath("/settings");
  return { success: true };
}

/**
 * Lets someone who already had a PIN before this feature existed (or who
 * skipped it) add a recovery question retroactively — authorized by the
 * current PIN rather than being a wide-open write.
 */
export async function setRecoveryQuestionAction(
  _prevState: PinActionState,
  formData: FormData
): Promise<PinActionState> {
  const business = await requireCurrentBusiness();
  const currentPin = formData.get("currentPin");

  if (!business.pinHash || typeof currentPin !== "string" || !verifyPin(currentPin, business.pinHash)) {
    return { error: "Current PIN is incorrect." };
  }

  const recovery = parseRecoveryFields(formData);
  if ("error" in recovery) return recovery;

  await prisma.business.update({
    where: { id: business.id },
    data: {
      pinRecoveryQuestion: recovery.question,
      pinRecoveryAnswerHash: hashRecoveryAnswer(recovery.answer),
    },
  });
  await logActivity(prisma, {
    businessId: business.id,
    action: "business.pin_recovery_set",
    entityType: "Business",
    entityId: business.id,
    summary: "Set a PIN recovery question",
  });
  revalidatePath("/settings");
  return { success: true };
}

export type FlushAllDataActionState = { error?: string; success?: boolean } | undefined;

/**
 * Wipes every customer, product, invoice, payment, quote, credit note,
 * expense, recurring invoice, stock record, and activity log entry, then
 * starts over with a fresh placeholder business — for clearing out seed/demo
 * data before real use, or a full reset. Irreversible short of restoring a
 * backup, so it's gated by an exact confirmation phrase and (if set) the PIN.
 */
export async function flushAllDataAction(
  _prevState: FlushAllDataActionState,
  formData: FormData
): Promise<FlushAllDataActionState> {
  const business = await requireCurrentBusiness();

  const confirmation = formData.get("confirmation");
  if (typeof confirmation !== "string" || confirmation !== FLUSH_CONFIRMATION_PHRASE) {
    return { error: `Type "${FLUSH_CONFIRMATION_PHRASE}" exactly to confirm.` };
  }

  if (business.pinHash) {
    const currentPin = formData.get("currentPin");
    if (typeof currentPin !== "string" || !verifyPin(currentPin, business.pinHash)) {
      return { error: "Current PIN is incorrect." };
    }
  }

  const oldBusinessId = business.id;
  const oldUploadsDir = path.join(getUploadsRoot(), "businesses", oldBusinessId);

  // Deleting the Business row cascades every child table (Customer, Product,
  // Invoice, Payment, Quote, CreditNote, Expense, RecurringInvoice,
  // StockMovement, ActivityLog all have onDelete: Cascade to Business) — the
  // one consistent way to wipe everything, rather than deleting each table
  // by hand in the right dependency order.
  await prisma.business.delete({ where: { id: oldBusinessId } });
  const fresh = await prisma.business.create({
    data: { name: PLACEHOLDER_BUSINESS_NAME, currency: "PKR" },
  });

  // Best-effort — an orphaned logo file left on disk isn't worth failing the
  // whole reset over.
  await rm(oldUploadsDir, { recursive: true, force: true }).catch(() => {});

  await logActivity(prisma, {
    businessId: fresh.id,
    action: "business.data_flushed",
    entityType: "Business",
    entityId: fresh.id,
    summary: "Cleared all business data and started fresh",
  });

  revalidatePath("/", "layout");
  return { success: true };
}
