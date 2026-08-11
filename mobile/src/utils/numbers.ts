import { getLanguage } from "@/src/i18n/languageStore";
import { getCurrencySymbol } from "@/src/settings/currency";

const WESTERN = "0123456789";
const HINDI = "٠١٢٣٤٥٦٧٨٩";

/** Convert digit characters to Hindi (Eastern Arabic) or Western based on UI language. */
export function localizeDigits(input: string): string {
  if (getLanguage() === "ar") {
    return input.replace(/[0-9]/g, (d) => HINDI[Number(d)] ?? d);
  }
  return input.replace(/[٠-٩]/g, (d) => {
    const i = HINDI.indexOf(d);
    return i >= 0 ? WESTERN[i] : d;
  });
}

/**
 * Format a number for display.
 * Arabic UI → ar-EG + Hindi digits; English UI → en-US + Western digits.
 */
export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  const locale = getLanguage() === "ar" ? "ar-EG" : "en-US";
  const formatted = value.toLocaleString(locale, options);
  // Some engines ignore ar-EG numeral system — force digit style explicitly.
  return localizeDigits(formatted);
}

/** Whole numbers (counts, page sizes, etc.). */
export function formatInteger(value: number): string {
  return formatNumber(value, { maximumFractionDigits: 0 });
}

/** Amount + active currency symbol. */
export function formatMoney(amount: number): string {
  const num = formatNumber(amount, { maximumFractionDigits: 2 });
  return `${num} ${getCurrencySymbol()}`;
}
