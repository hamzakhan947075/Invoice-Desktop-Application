import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto";

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

export const UNLOCK_COOKIE_NAME = "invoiceflow_unlocked";

/**
 * Deriving the cookie value from the current pinHash (rather than a fixed
 * secret) means changing or removing the PIN automatically invalidates any
 * previously issued unlock cookie — no separate invalidation step needed.
 */
export function unlockCookieValue(pinHash: string): string {
  return createHmac("sha256", pinHash).update("unlocked").digest("hex");
}
