/**
 * services/webstore/pricing.js
 *
 * Pure locale/currency + command-template helpers (no I/O).
 *
 * Extracted from controllers/webstoreController.js (Phase 7 decomposition).
 * Re-exported by the controllers/webstoreController.js barrel.
 */



const REGION_TO_CURRENCY = {
  AU: "aud", US: "usd", GB: "gbp", CA: "cad", NZ: "nzd",
  EU: "eur", DE: "eur", FR: "eur", NL: "eur", IT: "eur", ES: "eur",
  AT: "eur", BE: "eur", FI: "eur", GR: "eur", IE: "eur", PT: "eur",
};

export function preferredCurrencyFromLocale(locale) {
  if (!locale) return null;
  const region = locale.split(/[-_]/)[1]?.toUpperCase();
  return region ? (REGION_TO_CURRENCY[region] || null) : null;
}

/**
 * Format an amount in the smallest currency unit (e.g. cents) as a localised
 * currency string.  Handles zero-decimal currencies correctly.
 */
export function formatPrice(priceCents, currency, locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
    minimumFractionDigits: 2,
  }).format((Number(priceCents) || 0) / 100);
}

/**
 * Interpolate {{ placeholder }} tokens in a command template string.
 * Unknown tokens are left as empty strings.
 */
export function resolveCommandTemplate(template, metadata) {
  if (typeof template !== "string") return "";
  if (!metadata) return template;

  return Object.entries(metadata).reduce((cmd, [key, value]) => {
    const replacement = value === null || value === undefined ? "" : String(value);
    return cmd.replace(new RegExp(`{{\\s*${key}\\s*}}`, "gi"), replacement);
  }, template);
}

