import { createRequire } from "module";

const require = createRequire(import.meta.url);

/**
 * Wrapped period math.
 *
 * The Wrapped window runs mid-November → mid-December each year. The exact
 * bounds are configurable (config.json → `wrapped.periodStart` /
 * `wrapped.periodEnd`, "MM-DD" strings) so staff can nudge the dates without
 * a code change.
 *
 * `resolveWrappedPeriod` is deliberately pure (takes `now` + options) so the
 * date logic is unit-testable without touching config.json.
 */

const DEFAULTS = {
  enabled: true,
  periodStart: "11-15",
  periodEnd: "12-15",
};

function parseMmDd(value, fallback) {
  const raw = typeof value === "string" && /^\d{2}-\d{2}$/.test(value) ? value : fallback;
  const [month, day] = raw.split("-").map((n) => parseInt(n, 10));
  return { month, day };
}

/**
 * @param {Date} now
 * @param {{ periodStart?: string, periodEnd?: string, enabled?: boolean }} [opts]
 * @returns {{
 *   year: number,
 *   label: string,
 *   start: Date,
 *   end: Date,
 *   active: boolean,
 *   enabled: boolean
 * }}
 */
export function resolveWrappedPeriod(now = new Date(), opts = {}) {
  const enabled = opts.enabled ?? DEFAULTS.enabled;
  const startMd = parseMmDd(opts.periodStart, DEFAULTS.periodStart);
  const endMd = parseMmDd(opts.periodEnd, DEFAULTS.periodEnd);

  const year = now.getUTCFullYear();

  // Period bounds for the current calendar year, in UTC. `start` is the very
  // beginning of the start day; `end` is the very end of the end day.
  const start = new Date(Date.UTC(year, startMd.month - 1, startMd.day, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, endMd.month - 1, endMd.day, 23, 59, 59, 999));

  const active = enabled && now >= start && now <= end;

  return { year, label: String(year), start, end, active, enabled };
}

/**
 * The `wrapped` options from config.json (`{}` if the block or file is
 * missing). Used as the fallback layer beneath the editable DB settings.
 */
export function configWrappedOptions() {
  try {
    const config = require("../../config.json");
    return config?.wrapped ?? {};
  } catch {
    // config.json is gitignored and may be absent in some tooling contexts.
    return {};
  }
}

// The active period is resolved by `wrappedService.getConfiguredWrappedPeriod`,
// which layers the editable `wrappedSettings` DB row over `configWrappedOptions()`
// over `DEFAULTS`, then calls `resolveWrappedPeriod`.
