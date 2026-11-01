// Character counting for the post text. The current rule is a simple
// Unicode code point count with a 280 limit (not X's weighted count).
export const MAX_LENGTH = 280;

export function countText(text) {
  return [...text].length;
}

export function canPost(idToken, text) {
  const len = countText(text);
  return Boolean(idToken) && len > 0 && len <= MAX_LENGTH;
}
