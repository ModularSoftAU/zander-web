/**
 * Server-rendered SVG summary card for a Wrapped run — one image that recaps
 * every slide. Pure (payload -> SVG string) so it's unit-testable and needs no
 * headless browser. The page rasterises this SVG to PNG in a canvas; keeping it
 * fully self-contained (logo + avatar passed in as data URIs) is what lets the
 * canvas export without tainting.
 */

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dmy(dateish) {
  const d = new Date(dateish);
  if (Number.isNaN(d.getTime())) return String(dateish);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${d.getUTCFullYear()} ${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function plural(n, w) {
  return `${n} ${w}${n === 1 ? "" : "s"}`;
}

/** Human "time elapsed since <date>" — e.g. "2 years, 9 months". */
function elapsedSince(dateish) {
  const d = new Date(dateish);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let years = now.getUTCFullYear() - d.getUTCFullYear();
  let months = now.getUTCMonth() - d.getUTCMonth();
  if (now.getUTCDate() - d.getUTCDate() < 0) months--;
  if (months < 0) { months += 12; years--; }
  if (years < 0) return "today";
  if (years >= 1) return plural(years, "year") + (months ? `, ${plural(months, "month")}` : "");
  if (months >= 1) return plural(months, "month");
  const days = Math.max(0, Math.round((now - d) / 86400000));
  return days >= 1 ? plural(days, "day") : "today";
}

function fmtSecs(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/**
 * @param {object} payload  the stored Wrapped payload (version 1)
 * @param {{ logoDataUri?: string|null, avatarDataUri?: string|null, backgroundDataUri?: string|null }} [assets]
 * @returns {string} SVG markup, 1200x630 (OG-image proportions)
 */
export function renderWrappedCard(payload, assets = {}) {
  const p = payload || {};
  const s = p.stats || {};
  const user = p.user || {};
  const year = p.period?.label || p.period?.year || "";
  const { logoDataUri = null, avatarDataUri = null, backgroundDataUri = null } = assets;

  // Build the recap lines from whatever the run actually has.
  const lines = [];
  const push = (label, value) => {
    if (value === null || value === undefined || value === "") return;
    lines.push({ label, value: String(value) });
  };

  if (Number(s.playtime?.value) > 0) push("Playtime", s.playtime.display);
  if (Number(s.sessions?.value) > 0) push("Sessions", Number(s.sessions.value).toLocaleString());
  if (s.tenure?.firstSeen) {
    const ago = elapsedSince(s.tenure.firstSeen);
    push("Member for", ago ? `${ago} · since ${dmy(s.tenure.firstSeen)}` : dmy(s.tenure.firstSeen));
  }
  if (s.mostActiveDay?.date) {
    push("Busiest day", `${dmy(s.mostActiveDay.date)} · ${fmtSecs(s.mostActiveDay.seconds)}`);
  }
  if (Number(s.discordMessages?.value) > 0) push("Discord messages", Number(s.discordMessages.value).toLocaleString());
  if (Number(s.voiceMinutes?.value) > 0) push("Voice", s.voiceMinutes.display);
  if (s.reputation?.level != null) push("Reputation level", s.reputation.level);
  if (s.topCommand?.command) push("Top command", s.topCommand.command);
  if (s.friend?.name) push("Top voice companion", `${s.friend.name} · ${s.friend.minutes} min`);

  const rows = lines.length
    ? lines
        .slice(0, 7)
        .map((line, i) => {
          const y = 262 + i * 50;
          return `
      <text x="90" y="${y}" class="k">${esc(line.label)}</text>
      <text x="1110" y="${y}" class="v" text-anchor="end">${esc(line.value)}</text>`;
        })
        .join("")
    : `<text x="90" y="300" class="k">Not much logged for ${esc(year)} yet — check back soon.</text>`;

  const vibe = p.vibe?.label ? esc(p.vibe.label) : "";

  const img = (uri, attrs) =>
    `<image href="${esc(uri)}" xlink:href="${esc(uri)}" ${attrs}/>`;

  const avatar = avatarDataUri
    ? `<clipPath id="avclip"><rect x="1010" y="72" width="104" height="104" rx="16"/></clipPath>
       ${img(avatarDataUri, 'x="1010" y="72" width="104" height="104" clip-path="url(#avclip)" preserveAspectRatio="xMidYMid slice"')}`
    : "";

  const logo = logoDataUri
    ? img(logoDataUri, 'x="90" y="58" height="46" preserveAspectRatio="xMinYMid meet"')
    : "";
  const brandX = logoDataUri ? 148 : 90;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a103d"/>
      <stop offset="1" stop-color="#0a1a3d"/>
    </linearGradient>
  </defs>
  <style>
    text{font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;fill:#fff}
    .brand{font-size:24px;fill:#b9a7ff;letter-spacing:2px}
    .name{font-size:56px;font-weight:700}
    .year{font-size:32px;fill:#c9d4ff}
    .k{font-size:25px;fill:#a9b4d6}
    .v{font-size:27px;font-weight:600}
    .vibe{font-size:29px;font-weight:700;fill:#ffd479}
  </style>
  <rect width="1200" height="630" fill="url(#bg)"/>
  ${backgroundDataUri ? `<image href="${esc(backgroundDataUri)}" xlink:href="${esc(backgroundDataUri)}" x="0" y="0" width="1200" height="630" preserveAspectRatio="xMidYMid slice" opacity="0.45"/>
  <rect width="1200" height="630" fill="#0a1330" opacity="0.55"/>` : ""}
  ${logo}
  ${avatar}
  <text x="${brandX}" y="92" class="brand">WRAPPED · ${esc(year)}</text>
  <text x="90" y="170" class="name">${esc(user.username || "Player")}</text>
  <text x="90" y="212" class="year">Your year on the server</text>
  ${rows}
  ${vibe ? `<text x="90" y="600" class="vibe">“${vibe}”</text>` : ""}
</svg>`;
}
