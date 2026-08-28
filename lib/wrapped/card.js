/**
 * Server-rendered SVG summary card for a Wrapped run. Pure (payload -> SVG
 * string) so it's unit-testable and needs no headless browser. The page
 * offers a "Download image" button that rasterises this SVG to PNG in the
 * browser via a canvas.
 */

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statLine(label, value) {
  return { label, value: value == null ? "—" : String(value) };
}

/**
 * @param {object} payload  the stored Wrapped payload (version 1)
 * @returns {string} SVG markup, 1200x630 (OG-image proportions)
 */
export function renderWrappedCard(payload) {
  const p = payload || {};
  const s = p.stats || {};
  const user = p.user || {};
  const year = p.period?.label || p.period?.year || "";

  const lines = [
    statLine("Playtime", s.playtime?.display),
    statLine("Sessions", s.sessions?.value),
    statLine("Discord messages", s.discordMessages?.value),
    statLine("Voice", s.voiceMinutes?.display),
    statLine("Reputation level", s.reputation?.level),
    statLine("Top command", s.topCommand?.command),
  ];

  const rows = lines
    .map((line, i) => {
      const y = 250 + i * 58;
      return `
      <text x="90" y="${y}" class="k">${esc(line.label)}</text>
      <text x="1110" y="${y}" class="v" text-anchor="end">${esc(line.value)}</text>`;
    })
    .join("");

  const vibe = p.vibe?.label ? esc(p.vibe.label) : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a103d"/>
      <stop offset="1" stop-color="#0a1a3d"/>
    </linearGradient>
  </defs>
  <style>
    text{font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;fill:#fff}
    .brand{font-size:26px;fill:#b9a7ff;letter-spacing:2px}
    .name{font-size:58px;font-weight:700}
    .year{font-size:34px;fill:#c9d4ff}
    .k{font-size:26px;fill:#a9b4d6}
    .v{font-size:28px;font-weight:600}
    .vibe{font-size:30px;font-weight:700;fill:#ffd479}
  </style>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <text x="90" y="96" class="brand">CRAFTING FOR CHRIST · WRAPPED</text>
  <text x="90" y="164" class="name">${esc(user.username || "Player")}</text>
  <text x="90" y="206" class="year">${esc(year)}</text>
  ${rows}
  ${vibe ? `<text x="90" y="600" class="vibe">“${vibe}”</text>` : ""}
</svg>`;
}
