import { isValidUsername, getAvatarUrl, createMojangApiClient } from "./mojangApi.mjs";
import { createNameMcPreviousNamesService } from "./nameMcLookup.mjs";

export function createNameHistoryLookupService({
  requestTimeoutMs,
  cacheTtlMs,
  minIntervalMs,
  fetchImpl,
  mojangClient = createMojangApiClient({ requestTimeoutMs, fetchImpl }),
  nameMcService = createNameMcPreviousNamesService({ requestTimeoutMs, cacheTtlMs, minIntervalMs, fetchImpl }),
}) {
  async function lookupNameHistory(username) {
    if (!isValidUsername(username)) {
      return { status: "invalid" };
    }

    const identity = await mojangClient.resolveUsername(username);
    if (identity.status !== "found") {
      return identity; // "not_found" or "unavailable"
    }

    const history = await nameMcService.fetchPreviousNames(identity.uuid);
    if (history.status === "unavailable") {
      return { status: "unavailable" };
    }

    const previousNames = history.status === "found" ? history.previousNames : [];

    return {
      status: "found",
      currentName: identity.currentName,
      uuid: identity.uuid,
      previousNames,
      profileUrl: `https://namemc.com/profile/${identity.uuid}`,
      avatarUrl: getAvatarUrl(identity.uuid),
    };
  }

  return { lookupNameHistory };
}
