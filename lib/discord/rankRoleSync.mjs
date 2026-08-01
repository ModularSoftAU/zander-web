/**
 * Diffs a member's current Discord roles against the roles they should have,
 * restricted to the set of role IDs that map to a rank (`trackedRoleIds`).
 * Role IDs outside that set are never touched, even if present in the inputs.
 */
export function diffTrackedRoles(currentRoleIds, shouldHaveRoleIds, trackedRoleIds) {
  const current = new Set(currentRoleIds);
  const shouldHave = new Set(shouldHaveRoleIds);
  const tracked = new Set(trackedRoleIds);

  const toAdd = [...shouldHave].filter((id) => tracked.has(id) && !current.has(id));
  const toRemove = [...current].filter((id) => tracked.has(id) && !shouldHave.has(id));

  return { toAdd, toRemove };
}

async function queryDb(sql, params = []) {
  const { default: db } = await import("../../controllers/databaseController.js");
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) return reject(error);
      resolve(results || []);
    });
  });
}

/** Every distinct Discord role ID configured on any rank. */
export async function getTrackedRoleIds() {
  const rows = await queryDb(
    `SELECT DISTINCT discordRoleId FROM ranks WHERE discordRoleId IS NOT NULL AND discordRoleId != ''`
  );
  return rows.map((r) => String(r.discordRoleId));
}

/** Discord role IDs for every rank the given LuckPerms player uuid currently holds. */
export async function getUserRoleIdsByUuid(uuid) {
  if (!uuid) return [];
  const rows = await queryDb(
    `SELECT r.discordRoleId
       FROM userRanks ur
       JOIN ranks r ON ur.rankSlug = r.rankSlug
      WHERE ur.uuid = ? AND r.discordRoleId IS NOT NULL AND r.discordRoleId != ''`,
    [uuid]
  );
  return rows.map((r) => String(r.discordRoleId));
}
