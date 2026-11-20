// Character counting for the post text. The current rule is a simple
// Unicode code point count with a 280 limit (not X's weighted count).
export const MAX_LENGTH = 280;

export function countText(text) {
  // A non-string (a deformed value where text was expected) counts
  // as empty instead of throwing on the spread.
  return [...(typeof text === "string" ? text : "")].length;
}

export function canPost(idToken, text) {
  const len = countText(text);
  return Boolean(idToken) && len > 0 && len <= MAX_LENGTH;
}
