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
