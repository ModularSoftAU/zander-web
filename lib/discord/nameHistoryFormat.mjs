// lib/discord/nameHistoryFormat.mjs
import { sanitizeExternalText } from "./textSanitize.mjs";

// Discord embed field values are capped at 1024 characters.
const EMBED_FIELD_LIMIT = 1024;

function truncateFieldValue(value, limit = EMBED_FIELD_LIMIT) {
  if (value.length <= limit) return value;
  // Trim on a line boundary where possible so we don't cut a name/date mid-word.
  let cut = value.slice(0, limit);
  const lastNewline = cut.lastIndexOf("\n");
  if (lastNewline > 0) cut = cut.slice(0, lastNewline);
  return cut;
}

export function buildNameHistoryEmbedData(result) {
  const currentName = sanitizeExternalText(result.currentName);
  const previousNamesLines =
    result.previousNames.length === 0
      ? ["No previous usernames were found on NameMC for this profile."]
      : result.previousNames.map((p) => {
          const name = sanitizeExternalText(p.name);
          if (!p.changedAt) return name;
          const date = p.changedAt.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          return `${name} — changed ${date}`;
        });

  let previousNamesText = previousNamesLines.join("\n");
  if (previousNamesText.length > EMBED_FIELD_LIMIT) {
    // Reserve room for the "…and N more" suffix, then figure out how many
    // whole lines actually fit in what's left.
    let shownLines = previousNamesLines;
    let suffix = "";
    for (let count = previousNamesLines.length - 1; count >= 0; count--) {
      const candidateLines = previousNamesLines.slice(0, count);
      const overflow = previousNamesLines.length - count;
      const candidateSuffix = `\n…and ${overflow} more`;
      const candidate = candidateLines.join("\n") + candidateSuffix;
      if (candidate.length <= EMBED_FIELD_LIMIT) {
        shownLines = candidateLines;
        suffix = candidateSuffix;
        break;
      }
    }
    previousNamesText = truncateFieldValue(shownLines.join("\n") + suffix);
  }

  return {
    title: `Name History — ${currentName}`,
    fields: [
      { name: "Current name", value: currentName },
      { name: "UUID", value: result.uuid ?? "Unknown" },
      { name: "Previous names", value: previousNamesText },
      { name: "Profile", value: result.profileUrl },
    ],
    footer: `Identity: Mojang · History: NameMC · Retrieved ${new Date().toLocaleString("en-GB")}`,
    thumbnailUrl: result.avatarUrl,
  };
}

export function NOT_FOUND_MESSAGE(username) {
  return `No Minecraft account named "${sanitizeExternalText(username)}" could be found.`;
}

export const UNAVAILABLE_MESSAGE =
  "The Minecraft account lookup service is currently unavailable, so this username could not be checked. Please try again later.";

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
