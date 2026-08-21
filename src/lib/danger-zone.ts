/**
 * Shared with the client component so the button can pre-check the typed
 * text matches before submitting — lives outside settings/actions.ts because
 * a "use server" file may only export async functions, not plain constants.
 */
export const FLUSH_CONFIRMATION_PHRASE = "DELETE ALL DATA";
