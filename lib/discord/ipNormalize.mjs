import net from "node:net";

export function normalizeIp(input) {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new Error("Invalid IP address");
  }

  let value = input.trim();

  // Strip a leading slash (java Socket-style /1.2.3.4 artifacts).
  if (value.startsWith("/")) {
    value = value.slice(1);
  }

  // Bracketed IPv6 with optional port: [::1]:1234 or [::1]
  if (value.startsWith("[")) {
    const closeBracket = value.indexOf("]");
    if (closeBracket === -1) {
      throw new Error("Invalid IP address");
    }
    value = value.slice(1, closeBracket);
  } else if (net.isIPv4(value.split(":")[0]) && value.includes(":")) {
    // IPv4 with a trailing :port
    value = value.split(":")[0];
  }

  if (!net.isIPv4(value) && !net.isIPv6(value)) {
    throw new Error("Invalid IP address");
  }

  if (net.isIPv6(value)) {
    const lower = value.toLowerCase();
    const mappedMatch = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mappedMatch && net.isIPv4(mappedMatch[1])) {
      return mappedMatch[1];
    }
    return lower;
  }

  return value;
}
