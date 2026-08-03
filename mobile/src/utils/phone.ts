/** Normalize phone strings for tel: / WhatsApp deep links. */

export function digitsOnly(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export function telUrl(phone: string): string {
  return `tel:${digitsOnly(phone)}`;
}

export function whatsappUrl(phone: string): string {
  const n = digitsOnly(phone).replace(/^\+/, "");
  return `https://wa.me/${n}`;
}
