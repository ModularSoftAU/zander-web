export function sanitizeExternalText(text) {
  if (typeof text !== "string") return "";

  let result = text;

  // Break mention syntax by inserting a zero-width space after '@' or '<'.
  result = result.replace(/@(everyone|here)/gi, "@​$1");
  result = result.replace(/<(@[!&]?\d+|#\d+)>/g, "<​$1>");

  // Escape markdown special characters so external text can't alter embed formatting.
  // Includes [ ] ( ) so external text can't construct a disguised markdown hyperlink.
  result = result.replace(/([*_`~|[\]()])/g, "\\$1");

  return result;
}
