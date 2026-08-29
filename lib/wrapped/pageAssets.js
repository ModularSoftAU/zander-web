/**
 * Shared asset helpers for the Wrapped deck page — used by both the public
 * routes (routes/wrappedRoutes.js) and the admin preview
 * (routes/dashboard/wrapped.js) so they render identically.
 */
import { readdirSync, readFileSync, existsSync } from "fs";

/**
 * A random site "global" background image as an absolute asset path, so it
 * resolves the same from /wrapped, /wrapped/s/:id and /dashboard/wrapped/preview.
 * Returns null when the folder is missing or empty.
 */
export function pickGlobalBackground() {
  try {
    const files = readdirSync("./assets/images/globalImages/").filter((f) =>
      /\.(png|jpe?g|webp|gif|avif)$/i.test(f)
    );
    if (!files.length) return null;
    return "/images/globalImages/" + files[Math.floor(Math.random() * files.length)];
  } catch {
    return null;
  }
}

/** /audio path of a deployed Wrapped music bed, or null (page uses the generative bed). */
let musicUrlCache;
export function musicUrl() {
  if (musicUrlCache !== undefined) return musicUrlCache;
  if (existsSync("./assets/audio/wrapped-bed.mp3")) musicUrlCache = "/audio/wrapped-bed.mp3";
  else if (existsSync("./assets/audio/wrapped-bed.ogg")) musicUrlCache = "/audio/wrapped-bed.ogg";
  else musicUrlCache = null;
  return musicUrlCache;
}

/** The site logo as a base64 data URI, so the summary-card SVG stays self-contained. */
let logoDataUriCache;
export function logoDataUri() {
  if (logoDataUriCache !== undefined) return logoDataUriCache;
  try {
    logoDataUriCache =
      "data:image/png;base64," + readFileSync("./assets/images/siteLogo.png").toString("base64");
  } catch {
    logoDataUriCache = null;
  }
  return logoDataUriCache;
}

/** A player's crafthead avatar as a base64 data URI (cached per uuid; null on failure). */
const avatarCache = new Map();
export async function avatarDataUri(uuid, fetchImpl) {
  if (!uuid) return null;
  if (avatarCache.has(uuid)) return avatarCache.get(uuid);
  const doFetch = fetchImpl || (typeof fetch === "function" ? fetch : null);
  let out = null;
  if (doFetch) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 3500);
      const r = await doFetch(
        `https://crafthead.net/avatar/${encodeURIComponent(uuid)}?scale=6`,
        { signal: ctl.signal }
      );
      clearTimeout(timer);
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        const type = r.headers.get("content-type") || "image/png";
        out = `data:${type};base64,` + buf.toString("base64");
      }
    } catch {
      out = null;
    }
  }
  avatarCache.set(uuid, out);
  return out;
}
