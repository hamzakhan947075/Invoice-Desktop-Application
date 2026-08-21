"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  verifyPin,
  verifyRecoveryAnswer,
  hashPin,
  PIN_PATTERN,
  UNLOCK_COOKIE_NAME,
  unlockCookieValue,
} from "@/lib/pin";
import { logActivity } from "@/lib/activity-log";

export type UnlockActionState = { error?: string } | undefined;

export async function unlockAction(
  _prevState: UnlockActionState,
  formData: FormData
): Promise<UnlockActionState> {
  const pin = formData.get("pin");
  const next = formData.get("next");
  const nextPath = typeof next === "string" && next.startsWith("/") ? next : "/";

  if (typeof pin !== "string" || !pin) {
    return { error: "Enter your PIN." };
  }

  const business = await prisma.business.findFirst();
  if (!business?.pinHash) {
    redirect(nextPath);
  }

  if (!verifyPin(pin, business.pinHash)) {
    return { error: "Incorrect PIN." };
  }

  const cookieStore = await cookies();
  cookieStore.set(UNLOCK_COOKIE_NAME, unlockCookieValue(business.pinHash), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(nextPath);
}

export type RecoverPinActionState = { error?: string } | undefined;

/**
 * Verifies the recovery answer set alongside the PIN and, if correct, lets
 * the user set a brand-new PIN right here and unlocks them — the recovery
 * question/answer themselves are left in place so recovery still works
 * next time this PIN is forgotten too.
 */
export async function recoverPinAction(
  _prevState: RecoverPinActionState,
  formData: FormData
): Promise<RecoverPinActionState> {
  const answer = formData.get("answer");
  const newPin = formData.get("newPin");
  const confirmNewPin = formData.get("confirmNewPin");
  const next = formData.get("next");
  const nextPath = typeof next === "string" && next.startsWith("/") ? next : "/";

  const business = await prisma.business.findFirst();
  if (!business?.pinHash) {
    redirect(nextPath);
  }
  if (!business.pinRecoveryAnswerHash) {
    return { error: "No recovery question was set for this PIN." };
  }
  if (typeof answer !== "string" || !verifyRecoveryAnswer(answer, business.pinRecoveryAnswerHash)) {
    return { error: "That answer doesn't match." };
  }
  if (typeof newPin !== "string" || !PIN_PATTERN.test(newPin)) {
    return { error: "New PIN must be 4–8 digits." };
  }
  if (newPin !== confirmNewPin) {
    return { error: "PINs don't match." };
  }

  const newPinHash = hashPin(newPin);
  await prisma.business.update({ where: { id: business.id }, data: { pinHash: newPinHash } });
  await logActivity(prisma, {
    businessId: business.id,
    action: "business.pin_recovered",
    entityType: "Business",
    entityId: business.id,
    summary: "Reset the screen-lock PIN via the recovery question",
  });

  const cookieStore = await cookies();
  cookieStore.set(UNLOCK_COOKIE_NAME, unlockCookieValue(newPinHash), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(nextPath);
}
