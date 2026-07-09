/**
 * lib/mixed/pgmMapXmlParser.js
 *
 * Defensive parser for PGM `map.xml` files. Extracts the metadata Mixed
 * needs for its map browser and never throws — callers get a result object
 * so a single malformed map.xml can be skipped without aborting a sync run.
 *
 * Security: fast-xml-parser has no DOCTYPE/external-entity support (it is a
 * regex/state-machine based parser, not a full XML processor with DTD
 * resolution), so it is inherently XXE-safe. We additionally never fetch
 * any remote resource referenced from within the XML itself.
 */

import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
  processEntities: false,
});

// Module/tag name -> gamemode label. Checked recursively anywhere in the
// parsed document, since PGM maps vary in how deeply objectives are nested.
const GAMEMODE_TAGS = {
  wool: "CTW", wools: "CTW",
  flag: "CTF", flags: "CTF",
  core: "DTC", cores: "DTC",
  destroyable: "DTM", destroyables: "DTM",
  monument: "DTM", monuments: "DTM",
  "control-point": "CP", "control-points": "CP",
  hill: "CP", hills: "CP",
  blitz: "Blitz",
  score: "Score",
};

function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(node) {
  if (node == null) return null;
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node === "object" && "#text" in node) return String(node["#text"]);
  return null;
}

/** Recursively collects gamemodes by scanning every object key in the parsed document. */
function detectGamemodes(node, found = new Set()) {
  if (node == null || typeof node !== "object") return found;
  for (const [key, value] of Object.entries(node)) {
    const tag = key.toLowerCase();
    if (GAMEMODE_TAGS[tag]) found.add(GAMEMODE_TAGS[tag]);
    if (value && typeof value === "object") {
      for (const item of toArray(value)) detectGamemodes(item, found);
    }
  }
  return found;
}

function extractAuthors(mapNode) {
  const authorsNode = mapNode.authors?.author ?? mapNode.author;
  return toArray(authorsNode)
    .map((a) => textOf(a) || a?.["@_name"] || null)
    .filter(Boolean);
}

function extractContributors(mapNode) {
  const contribNode = mapNode.contributors?.contributor ?? mapNode.contributor;
  return toArray(contribNode)
    .map((c) => textOf(c) || c?.["@_name"] || null)
    .filter(Boolean);
}

function extractTeams(mapNode) {
  const teamNode = mapNode.teams?.team;
  return toArray(teamNode).map((t) => ({
    id: t?.["@_id"] || null,
    color: t?.["@_color"] || null,
    name: textOf(t) || t?.["@_name"] || t?.["@_id"] || null,
  })).filter((t) => t.id || t.name);
}

function extractObjectives(mapNode) {
  const objectivesNode = mapNode.objectives?.objective;
  if (objectivesNode) {
    return toArray(objectivesNode).map((o) => textOf(o) || JSON.stringify(o));
  }
  // Fallback: treat the single top-level <objective> tag as the objective summary.
  const single = textOf(mapNode.objective);
  return single ? [single] : [];
}

/**
 * @param {string} xmlString raw contents of a PGM map.xml file
 * @returns {{ok: true, data: object} | {ok: false, error: string}}
 */
export function parseMapXml(xmlString) {
  try {
    if (typeof xmlString !== "string" || !xmlString.trim()) {
      return { ok: false, error: "Empty or non-string XML input." };
    }
    const parsed = parser.parse(xmlString);
    const mapNode = parsed?.map;
    if (!mapNode || typeof mapNode !== "object") {
      return { ok: false, error: "No <map> root element found." };
    }

    const gamemodesFound = Array.from(detectGamemodes(mapNode));
    const gamemode = gamemodesFound[0] || "Unknown";

    const data = {
      name: textOf(mapNode.name) || null,
      version: textOf(mapNode.version) || null,
      description: textOf(mapNode.objective) || null,
      gamemode,
      gamemodes: gamemodesFound,
      authors: extractAuthors(mapNode),
      contributors: extractContributors(mapNode),
      teams: extractTeams(mapNode),
      objectives: extractObjectives(mapNode),
      rules: toArray(mapNode.rules?.rule).map((r) => textOf(r)).filter(Boolean),
    };

    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: `Failed to parse map.xml: ${err?.message || err}` };
  }
}

export { detectGamemodes };
