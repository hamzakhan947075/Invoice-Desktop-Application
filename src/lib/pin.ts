import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto";

export const PIN_PATTERN = /^\d{4,8}$/;

/** Stores as "salt:hash" (both hex) in Business.pinHash — no separate secrets table needed. */
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(pin, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/** Case/whitespace-insensitive so "Blue" and "blue " both match what was set. */
function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase();
}

export function hashRecoveryAnswer(answer: string): string {
  return hashPin(normalizeAnswer(answer));
}

export function verifyRecoveryAnswer(answer: string, stored: string): boolean {
  return verifyPin(normalizeAnswer(answer), stored);
}

export const UNLOCK_COOKIE_NAME = "invoiceflow_unlocked";

/**
 * Deriving the cookie value from the current pinHash (rather than a fixed
 * secret) means changing or removing the PIN automatically invalidates any
 * previously issued unlock cookie — no separate invalidation step needed.
 */
export function unlockCookieValue(pinHash: string): string {
  return createHmac("sha256", pinHash).update("unlocked").digest("hex");
}
