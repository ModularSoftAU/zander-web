import { Collection } from "discord.js";

function normalizeIdentifier(identifier = "") {
  const trimmed = identifier.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("@")) {
    return trimmed.slice(1).trim();
  }

  return trimmed;
}

function getUserTag(user) {
  if (!user) {
    return null;
  }

  const username = user.username?.toLowerCase?.() ?? null;
  if (!username) {
    return null;
  }

  const discriminator = user.discriminator ?? null;
  if (!discriminator || discriminator === "0") {
    return username;
  }

  return `${username}#${discriminator}`;
}

export async function resolveDiscordUserId(
  interaction,
  { discordUser = null, discordTag = null } = {}
) {
  if (discordUser && discordUser.id) {
    return discordUser.id;
  }

  if (!discordTag) {
    return null;
  }

  const sanitized = normalizeIdentifier(discordTag);
  if (!sanitized) {
    return null;
  }

  const mentionMatch = sanitized.match(/^<@!?([0-9]{17,20})>$/);
  if (mentionMatch) {
    return mentionMatch[1];
  }

  if (/^[0-9]{17,20}$/.test(sanitized)) {
    return sanitized;
  }

  const normalized = sanitized.toLowerCase();

  const cachedUser = interaction.client?.users?.cache?.find((user) => {
    const tag = getUserTag(user);
    if (!tag) {
      return false;
    }

    return tag === normalized || user.username?.toLowerCase?.() === normalized;
  });

  if (cachedUser?.id) {
    return cachedUser.id;
  }

  const guild = interaction.guild ?? null;
  if (!guild) {
    return null;
  }

  try {
    const fetchedMembers = await guild.members.fetch({
      query: sanitized,
      limit: 5,
      withPresences: false,
    });

    if (fetchedMembers instanceof Collection) {
      const matchedMember = fetchedMembers.find((member) => {
        const memberTag = getUserTag(member.user);
        const memberUsername = member.user?.username?.toLowerCase?.() ?? null;
        const displayName = member.displayName?.toLowerCase?.() ?? null;

        return (
          memberTag === normalized ||
          memberUsername === normalized ||
          displayName === normalized
        );
      });

      if (matchedMember?.user?.id) {
        return matchedMember.user.id;
      }
    }
  } catch (error) {
    console.warn("Failed to resolve Discord user via guild search", error);
  }

  return null;
}
