const SHARED_IP_WARNING =
  "Shared IP addresses are an indicator only. They are not proof that accounts belong to the same person.";

// Discord embed field values are capped at 1024 characters.
const EMBED_FIELD_LIMIT = 1024;

function formatOtherAccounts(otherAccounts, limit = EMBED_FIELD_LIMIT) {
  if (otherAccounts.length === 0) return "none";
  let joined = otherAccounts.join(", ");
  if (joined.length <= limit) return joined;

  let shownCount = otherAccounts.length;
  while (shownCount > 0) {
    const overflow = otherAccounts.length - shownCount;
    const candidate = `${otherAccounts.slice(0, shownCount).join(", ")}\n…and ${overflow} more`;
    if (candidate.length <= limit) {
      joined = candidate;
      break;
    }
    shownCount--;
  }
  return joined.length <= limit ? joined : joined.slice(0, Math.max(0, limit));
}

export function maskIp(ip) {
  if (ip.includes(":")) {
    const parts = ip.split(":");
    parts[parts.length - 1] = "xxx";
    return parts.join(":");
  }
  const parts = ip.split(".");
  parts[parts.length - 1] = "xxx";
  return parts.join(".");
}

export function paginate(items, pageSize) {
  if (items.length === 0) return [[]];
  const pages = [];
  for (let i = 0; i < items.length; i += pageSize) {
    pages.push(items.slice(i, i + pageSize));
  }
  return pages;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function buildUsernamePageEmbedData(page, pageIndex, totalPages, { username, uuid, status }) {
  const statusLine = status.online
    ? `Online — ${status.server ?? "unknown server"}`
    : "Offline";

  return {
    title: `IP Check — ${username}`,
    description: [`**UUID**\n${uuid}`, `**Status**\n${statusLine}`, `Page ${pageIndex + 1} of ${totalPages}`].join("\n\n"),
    fields: page.map((record) => {
      const prefixLines = [
        `First seen: ${formatDate(record.first_seen_at)}`,
        `Last seen: ${formatDate(record.last_seen_at)}`,
        `Sessions: ${record.session_count}`,
      ];
      // Budget the other-accounts line based on the space actually left
      // over after the prefix lines + the "Other accounts: " label + the
      // newlines joining everything together, so the FULL assembled field
      // value (not just this one line in isolation) stays within Discord's
      // 1024-char embed field limit.
      const otherAccountsLabel = "Other accounts: ";
      const prefixLength = prefixLines.join("\n").length + 1 /* newline before label line */ + otherAccountsLabel.length;
      const budget = Math.max(0, EMBED_FIELD_LIMIT - prefixLength);
      const value = [
        ...prefixLines,
        `${otherAccountsLabel}${formatOtherAccounts(record.otherAccounts, budget)}`,
      ].join("\n");

      return {
        name: record.ip_address,
        // Final safety net regardless of where the length came from.
        value: value.length <= EMBED_FIELD_LIMIT ? value : value.slice(0, EMBED_FIELD_LIMIT),
      };
    }),
    footer: SHARED_IP_WARNING,
  };
}

export function buildIpPageEmbedData(page, pageIndex, totalPages, ipAddress) {
  return {
    title: `IP Check — ${ipAddress}`,
    description: `Page ${pageIndex + 1} of ${totalPages}`,
    fields: page.map((record) => ({
      name: record.username,
      value: [
        `UUID: ${record.uuid}`,
        `First seen: ${formatDate(record.first_seen_at)}`,
        `Last seen: ${formatDate(record.last_seen_at)}`,
        `Sessions: ${record.session_count}`,
        `Status: ${record.status.online ? `Online — ${record.status.server ?? "unknown server"}` : "Offline"}`,
      ].join("\n"),
    })),
    footer: SHARED_IP_WARNING,
  };
}
