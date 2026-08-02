// lib/discord/nameHistoryFormat.mjs
import { sanitizeExternalText } from "./textSanitize.mjs";

export function buildNameHistoryEmbedData(result) {
  const currentName = sanitizeExternalText(result.currentName);
  const previousNamesText =
    result.previousNames.length === 0
      ? "No previous usernames were found on NameMC for this profile."
      : result.previousNames
          .map((p) => {
            const name = sanitizeExternalText(p.name);
            if (!p.changedAt) return name;
            const date = p.changedAt.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });
            return `${name} — changed ${date}`;
          })
          .join("\n");

  return {
    title: `Name History — ${currentName}`,
    fields: [
      { name: "Current name", value: currentName },
      { name: "UUID", value: result.uuid ?? "Unknown" },
      { name: "Previous names", value: previousNamesText },
      { name: "Profile", value: result.profileUrl },
    ],
    footer: `Source: NameMC · Retrieved ${new Date().toLocaleString("en-GB")}`,
    thumbnailUrl: result.avatarUrl,
  };
}

export function NOT_FOUND_MESSAGE(username) {
  return `No NameMC profile could be found for "${sanitizeExternalText(username)}".`;
}

export const UNAVAILABLE_MESSAGE =
  "NameMC is currently unavailable, so this username could not be checked. Please try again later.";

export function createCooldownTracker(cooldownSeconds) {
  const lastUse = new Map();

  return {
    isOnCooldown(discordUserId, isAdmin) {
      if (isAdmin) return false;
      const last = lastUse.get(discordUserId);
      if (!last) return false;
      return Date.now() - last < cooldownSeconds * 1000;
    },
    recordUse(discordUserId) {
      lastUse.set(discordUserId, Date.now());
    },
  };
}
