export function parseIntParam(value, fallback, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

export function parseOffset(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function safeCursor(cursor) {
  const value = typeof cursor === "string" && cursor.trim() ? cursor.trim() : "0";
  if