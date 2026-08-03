import fetchDefault from "node-fetch";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;
const USER_AGENT = "ZanderBot/1.0 (+namehistory-lookup; contact: staff)";

export function isValidUsername(username) {
  return typeof username === "string" && USERNAME_PATTERN.test(username);
}

export function getAvatarUrl(uuid) {
  return `https://crafatar.com/avatars/${uuid}?size=128&overlay`;
}

function insertDashes(undashedUuid) {
  return [
    undashedUuid.slice(0, 8),
    undashedUuid.slice(8, 12),
    undashedUuid.slice(12, 16),
    undashedUuid.slice(16, 20),
    undashedUuid.slice(20, 32),
  ].join("-");
}

export function createMojangApiClient({ requestTimeoutMs, fetchImpl = fetchDefault }) {
  async function resolveUsername(username) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetchImpl(
        `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`,
        { headers: { "User-Agent": USER_AGENT }, signal: controller.signal }
      );

      if (response.status === 204 || response.status === 404) {
        return { status: "not_found" };
      }
      if (!response.ok) {
        console.error(`[mojangApi] Non-OK response resolving username: HTTP ${response.status}`);
        return { status: "unavailable" };
      }

      const body = await response.json();
      if (!body?.id || !body?.name) {
        console.error("[mojangApi] Unexpected response body shape from Mojang API");
        return { status: "unavailable" };
      }

      return {
        status: "found",
        uuid: insertDashes(body.id),
        currentName: body.name,
      };
    } catch (err) {
      console.error("[mojangApi] Failed to resolve username:", err?.message ?? err);
      return { status: "unavailable" };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { resolveUsername };
}
