/** Normalize phone strings for tel: / WhatsApp deep links. */

export function digitsOnly(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export function telUrl(phone: string): string {
  return `tel:${digitsOnly(phone)}`;
}

/** Build a wa.me link; optional `text` is prefilled in the chat compose box. */
export function whatsappUrl(phone: string, text?: string): string {
  const n = digitsOnly(phone).replace(/^\+/, "");
  const base = `https://wa.me/${n}`;
  if (!text?.trim()) return base;
  return `${base}?text=${encodeURIComponent(text.trim())}`;
}
