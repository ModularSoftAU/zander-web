export function hasPermission(permissions, node) {
  if (!Array.isArray(permissions) || !node) {
    return false;
  }

  const requested = String(node).trim();
  if (!requested) {
    return false;
  }

  return permissions.some((permission) => {
    if (!permission) return false;

    const trimmed = String(permission).trim();
    if (!trimmed) return false;

    if (trimmed === "*") return true;
    if (trimmed === requested) return true;

    if (trimmed.endsWith(".*")) {
      const base = trimmed.slice(0, -1);
      return requested.startsWith(base);
    }

    return false;
  });
}
