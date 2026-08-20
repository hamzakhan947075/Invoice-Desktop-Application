"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPin, UNLOCK_COOKIE_NAME, unlockCookieValue } from "@/lib/pin";

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
