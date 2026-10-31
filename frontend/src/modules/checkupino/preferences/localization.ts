export const PRODUCT_LOCALE_STORAGE_KEY = "checkupino.locale.v1";
export const LEGACY_LOCALE_STORAGE_KEY = "I18N_LANGUAGE";
export const PRODUCT_TIME_ZONE = "Asia/Tehran";

export const productLocales = ["fa", "en"] as const;

export type ProductLocale = (typeof productLocales)[number];
export type ProductDirection = "ltr" | "rtl";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const localeTags: Readonly<Record<ProductLocale, string>> = {
  en: "en-US-u-ca-gregory-nu-latn",
  fa: "fa-IR-u-ca-persian-nu-arabext",
};

const asciiDigits = "0123456789";
const arabicIndicDigits = "٠١٢٣٤٥٦٧٨٩";
const persianDigits = "۰۱۲۳۴۵۶۷۸۹";

export const isProductLocale = (value: unknown): value is ProductLocale =>
  typeof value === "string" && productLocales.includes(value as ProductLocale);

export const normalizeProductLocale = (
  value: unknown,
  fallback: ProductLocale = "fa",
): ProductLocale => (isProductLocale(value) ? value : fallback);

export const directionForProductLocale = (locale: ProductLocale): ProductDirection =>
  locale === "fa" ? "rtl" : "ltr";

export const applyProductLocale = (root: HTMLElement, locale: ProductLocale) => {
  root.lang = locale;
  root.dir = directionForProductLocale(locale);
  root.dataset.language = locale;
};

export const readProductLocale = (
  storage: Pick<StorageLike, "getItem">,
  configuredDefault: unknown,
): ProductLocale => {
  try {
    const stored = storage.getItem(PRODUCT_LOCALE_STORAGE_KEY);
    if (isProductLocale(stored)) return stored;

    const legacy = storage.getItem(LEGACY_LOCALE_STORAGE_KEY);
    if (isProductLocale(legacy)) return legacy;
  } catch {
    // Storage may be unavailable or blocked; the configured/default locale remains usable.
  }

  return normalizeProductLocale(configuredDefault);
};

export const persistProductLocale = (
  storage: Pick<StorageLike, "setItem">,
  locale: ProductLocale,
) => {
  try {
    storage.setItem(PRODUCT_LOCALE_STORAGE_KEY, locale);
    // Keep the retained Velzon/i18next boundary coherent until F22 removes the legacy key.
    storage.setItem(LEGACY_LOCALE_STORAGE_KEY, locale);
  } catch {
    // A blocked preference store must not prevent language/direction from being applied.
  }
};

export const initializeProductLocale = (
  root: HTMLElement,
  storage: StorageLike,
  configuredDefault: unknown,
) => {
  const locale = readProductLocale(storage, configuredDefault);
  persistProductLocale(storage, locale);
  applyProductLocale(root, locale);
  return locale;
};

export const normalizeNumericInput = (value: string) =>
  Array.from(value, (character) => {
    const persianIndex = persianDigits.indexOf(character);
    if (persianIndex >= 0) return asciiDigits[persianIndex];

    const arabicIndex = arabicIndicDigits.indexOf(character);
    return arabicIndex >= 0 ? asciiDigits[arabicIndex] : character;
  }).join("");

export const formatProductNumber = (value: number, locale: ProductLocale) =>
  new Intl.NumberFormat(localeTags[locale]).format(value);

const parseDateOnly = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError(`Invalid date-only value: ${value}`);

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    throw new RangeError(`Invalid date-only value: ${value}`);
  }
  return date;
};

export const formatProductDate = (value: string, locale: ProductLocale) =>
  new Intl.DateTimeFormat(localeTags[locale], {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric",
  }).format(parseDateOnly(value));

export const formatProductTimestamp = (value: Date | string, locale: ProductLocale) => {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime()))
    throw new RangeError(`Invalid timestamp value: ${String(value)}`);

  return new Intl.DateTimeFormat(localeTags[locale], {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: PRODUCT_TIME_ZONE,
    timeZoneName: "short",
    year: "numeric",
  }).format(instant);
};
