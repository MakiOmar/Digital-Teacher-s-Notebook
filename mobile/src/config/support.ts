/**
 * Support contact for license requests and technical help (WhatsApp).
 * International digits only (no + / spaces). Override with EXPO_PUBLIC_SUPPORT_WHATSAPP.
 */
export const SUPPORT_WHATSAPP =
  process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP?.replace(/\D/g, "") ||
  "201026795795";
