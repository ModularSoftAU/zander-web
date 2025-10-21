export function formatDiscordTimestamp(
  value,
  { fallback = "No record", dateStyle = "D", includeRelative = true } = {}
) {
  if (value === null || value === undefined) {
    return fallback;
  }

  let milliseconds;

  if (value instanceof Date) {
    milliseconds = value.getTime();
  } else if (typeof value === "number") {
    milliseconds = value > 1e12 ? value : value * 1000;
  } else {
    const raw = String(value).trim();
    if (!raw) {
      return fallback;
    }

    if (/^0{4}-0{2}-0{2}/.test(raw)) {
      return fallback;
    }

    let normalized = raw;

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
      normalized = `${raw.replace(" ", "T")}Z`;
    }

    const parsed = Date.parse(normalized);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    milliseconds = parsed;
  }

  if (!Number.isFinite(milliseconds)) {
    return fallback;
  }

  const timestamp = Math.floor(milliseconds / 1000);
  if (!Number.isFinite(timestamp)) {
    return fallback;
  }

  const base = `<t:${timestamp}:${dateStyle}>`;
  if (!includeRelative) {
    return base;
  }

  return `${base} (<t:${timestamp}:R>)`;
}
