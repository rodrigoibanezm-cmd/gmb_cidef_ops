export function parseIntParam(value, fallback, max) {
  const n = Number(value);

  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(n), max);
}

export function parseOffset(value) {
  const n = Number(value);

  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }

  return Math.floor(n);
}

export function safeCursor(cursor) {
  const value = typeof cursor === "string" && cursor.trim() ? cursor.trim() : "0";

  if (!/^\d+$/.test(value)) {
    throw new Error("cursor_not_allowed");
  }

  return value;
}

export function safeOptionalDate(date) {
  const value = typeof date === "string" && date.trim() ? date.trim() : null;

  if (!value) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("date_not_allowed");
  }

  return value;
}

export function safeTenantId(tenantId) {
  const value = typeof tenantId === "string" && tenantId.trim() ? tenantId.trim() : null;

  if (!value) {
    throw new Error("tenant_id_required");
  }

  if (!/^[a-z0-9_.-]+$/.test(value)) {
    throw new Error("tenant_id_not_allowed");
  }

  return value;
}

export function safeReviewPattern(pattern) {
  const value = typeof pattern === "string" && pattern.trim() ? pattern.trim() : "gmb:review:*";

  if (!value.startsWith("gmb:review:")) {
    throw new Error("pattern_not_allowed");
  }

  return value;
}

export function safeGmbKey(key) {
  const value = typeof key === "string" && key.trim() ? key.trim() : null;

  if (!value) {
    throw new Error("key_required");
  }

  if (!value.startsWith("gmb:")) {
    throw new Error("key_not_allowed");
  }

  return value;
}
