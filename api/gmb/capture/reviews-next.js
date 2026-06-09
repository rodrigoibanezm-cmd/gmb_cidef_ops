import { dbQuery } from "../../../lib/gmb/postgres.js";

function authorized(req) {
  const expected = process.env.CRON_SECRET;
  const provided = req.query.token || req.headers["x-cron-secret"];
  return Boolean(expected && provided && provided === expected);
}

function getRedisEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_READ_ONLY_TOKEN || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error("missing_redis_env");
  }

  return { url: url.replace(/\/$/, ""), token };
}

function parseIntParam(value, fallback, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

function safeCursor(cursor) {
  const value = typeof cursor === "string" && cursor.trim() ? cursor.trim() : "0";
  if (!/^\d+$/.test(value)) throw new Error("cursor_not_allowed");
  return value;
}

function safeTenantId(tenantId) {
  const value = typeof tenantId === "string" && tenantId.trim() ? tenantId.trim() : null;
  if (!value) throw new Error("tenant_id_required");
  if (!/^[a-z0-9_.-]+$/.test(value)) throw new Error("tenant_id_not_allowed");
  return value;
}

function safePattern(pattern) {
  const value = typeof pattern === "string" && pattern.trim() ? pattern.trim() : "gmb:review:*";
  if (!value.startsWith("gmb:review:")) throw new Error("pattern_not_allowed");
  return value;
}

function safeKey(key) {
  if (typeof key !== "string" || !key.trim()) throw new Error("key_required");
  const value = key.trim();
  if (!value.startsWith("gmb:")) throw new Error("key_not_allowed");
  return value;
}

async function redis(command) {
  const { url, token } = getRedisEnv();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.error) {
    const error = new Error("redis_request_failed");
    error.status = response.status;
    error.details = payload;
    throw error;
  }

  return payload?.result;
}

function asPreview(value, maxChars) {
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  return {
    length: raw.length,
    preview: raw.length > maxChars ? `${raw.slice(0, maxChars)}...` : raw,
  };
}

async function scanKeys(pattern, count, maxKeys, startCursor = "0") {
  let cursor = startCursor;
  const keys = [];

  do {
    const result = await redis(["SCAN", cursor, "MATCH", pattern, "COUNT", count]);
    cursor = String(result?.[0] || "0");
    const batch = Array.isArray(result?.[1]) ? result[1] : [];

    for (const key of batch) {
      if (typeof key === "string" && key.startsWith("gmb:")) keys.push(key);
      if (keys.length >= maxKeys) break;
    }
  } while (cursor !== "0" && keys.length < maxKeys);

  return { keys, next_cursor: cursor };
}

async function countKeys(pattern, count) {
  let cursor = "0";
  let total = 0;
  let iterations = 0;

  do {
    const result = await redis(["SCAN", cursor, "MATCH", pattern, "COUNT", count]);
    cursor = String(result?.[0] || "0");
    const batch = Array.isArray(result?.[1]) ? result[1] : [];
    total += batch.filter((key) => typeof key === "string" && key.startsWith("gmb:review:")).length;
    iterations += 1;
  } while (cursor !== "0");

  return { total, iterations };
}

async function countKeysByTenant({ pattern, count, tenantId }) {
  let cursor = "0";
  let scanned = 0;
  let total = 0;
  let unknown_place = 0;
  let failed = 0;
  let iterations = 0;
  const tenantCache = new Map();

  do {
    const result = await redis(["SCAN", cursor, "MATCH", pattern, "COUNT", count]);
    cursor = String(result?.[0] || "0");
    const batch = Array.isArray(result?.[1]) ? result[1] : [];
    iterations += 1;

    for (const key of batch) {
      if (typeof key !== "string" || !key.startsWith("gmb:review:")) continue;
      scanned += 1;

      try {
        const raw = await redis(["GET", key]);
        const review = parseReview(raw);
        if (!review.place_id) throw new Error("missing_place_id");

        let resolvedTenantId = tenantCache.get(review.place_id);
        if (resolvedTenantId === undefined) {
          resolvedTenantId = await resolveTenantId(review.place_id);
          tenantCache.set(review.place_id, resolvedTenantId);
        }

        if (!resolvedTenantId) {
          unknown_place += 1;
          continue;
        }

        if (resolvedTenantId === tenantId) total += 1;
      } catch {
        failed += 1;
      }
    }
  } while (cursor !== "0");

  return { tenant_id: tenantId, total, scanned, unknown_place, failed, iterations };
}

async function inspectKey(key, maxChars) {
  const type = await redis(["TYPE", key]);
  let value = null;

  if (type === "string") value = await redis(["GET", key]);
  else if (type === "list") value = await redis(["LRANGE", key, 0, 9]);
  else if (type === "set") value = await redis(["SMEMBERS", key]);
  else if (type === "zset") value = await redis(["ZRANGE", key, 0, 9, "WITHSCORES"]);
  else if (type === "hash") value = await redis(["HGETALL", key]);

  return { key, type, ...asPreview(value, maxChars) };
}

function parseReview(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("empty_review_value");
  }

  return JSON.parse(raw);
}

async function resolveTenantId(placeId) {
  const rows = await dbQuery(
    `select tenant_id
     from places
     where place_id = $1
     limit 1`,
    [placeId]
  );

  return rows[0]?.tenant_id || null;
}

async function upsertMigratedReview(review, tenantId) {
  await dbQuery(
    `insert into place_reviews (
      tenant_id,
      place_id,
      review_hash,
      captured_date,
      captured_at,
      updated_at,
      author,
      review_date,
      rating,
      text,
      language,
      original_text,
      original_language,
      source,
      raw
    ) values ($1,$2,$3,$4,$5,now(),$6,$7,$8,$9,$10,$11,$12,$13,$14)
    on conflict (tenant_id, place_id, review_hash)
    do update set
      captured_date = excluded.captured_date,
      updated_at = now(),
      author = excluded.author,
      review_date = excluded.review_date,
      rating = excluded.rating,
      text = excluded.text,
      language = excluded.language,
      original_text = excluded.original_text,
      original_language = excluded.original_language,
      source = excluded.source,
      raw = excluded.raw`,
    [
      tenantId,
      review.place_id,
      review.review_hash,
      review.captured_date,
      review.captured_at || null,
      review.author || null,
      review.review_date || null,
      review.rating || null,
      review.text || null,
      review.language || null,
      review.original_text || null,
      review.original_language || null,
      review.source || "upstash_migration",
      JSON.stringify(review),
    ]
  );
}

async function migrateReviews({ pattern, count, limit, cursor, dryRun }) {
  const scan = await scanKeys(pattern, count, limit, cursor);
  const result = {
    cursor,
    next_cursor: scan.next_cursor,
    scanned: scan.keys.length,
    inserted_or_updated: 0,
    skipped_unknown_place: 0,
    failed: 0,
    dry_run: dryRun,
    done: scan.next_cursor === "0",
    errors: [],
  };

  const tenantCache = new Map();

  for (const key of scan.keys) {
    try {
      const raw = await redis(["GET", key]);
      const review = parseReview(raw);

      if (!review.place_id || !review.review_hash || !review.captured_date) {
        throw new Error("invalid_review_shape");
      }

      let tenantId = tenantCache.get(review.place_id);
      if (tenantId === undefined) {
        tenantId = await resolveTenantId(review.place_id);
        tenantCache.set(review.place_id, tenantId);
      }

      if (!tenantId) {
        result.skipped_unknown_place += 1;
        continue;
      }

      if (!dryRun) {
        await upsertMigratedReview(review, tenantId);
      }

      result.inserted_or_updated += 1;
    } catch (error) {
      result.failed += 1;
      if (result.errors.length < 20) {
        result.errors.push({ key, error: error.message });
      }
    }
  }

  return result;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  if (!authorized(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const action = req.query.action || "scan";
  const maxChars = parseIntParam(req.query.max_chars, 1200, 10000);

  try {
    if (action === "scan") {
      const pattern = safePattern(req.query.pattern);
      const count = parseIntParam(req.query.count, 100, 1000);
      const maxKeys = parseIntParam(req.query.max_keys, 100, 500);
      const cursor = safeCursor(req.query.cursor);
      const scan = await scanKeys(pattern, count, maxKeys, cursor);
      return res.status(200).json({ ok: true, temporary: true, action, pattern, cursor, ...scan });
    }

    if (action === "count_reviews") {
      const pattern = safePattern(req.query.pattern || "gmb:review:*");
      const count = parseIntParam(req.query.count, 1000, 5000);
      const result = await countKeys(pattern, count);
      return res.status(200).json({ ok: true, temporary: true, action, pattern, ...result });
    }

    if (action === "count_reviews_by_tenant") {
      const tenantId = safeTenantId(req.query.tenant_id || req.query.tenant);
      const pattern = safePattern(req.query.pattern || "gmb:review:*");
      const count = parseIntParam(req.query.count, 1000, 5000);
      const result = await countKeysByTenant({ pattern, count, tenantId });
      return res.status(200).json({ ok: true, temporary: true, action, pattern, ...result });
    }

    if (action === "get") {
      const key = safeKey(req.query.key);
      const item = await inspectKey(key, maxChars);
      return res.status(200).json({ ok: true, temporary: true, action, item });
    }

    if (action === "preview") {
      const pattern = safePattern(req.query.pattern);
      const count = parseIntParam(req.query.count, 100, 1000);
      const maxKeys = parseIntParam(req.query.max_keys, 20, 50);
      const cursor = safeCursor(req.query.cursor);
      const scan = await scanKeys(pattern, count, maxKeys, cursor);
      const items = [];

      for (const key of scan.keys) {
        items.push(await inspectKey(key, maxChars));
      }

      return res.status(200).json({ ok: true, temporary: true, action, pattern, cursor, next_cursor: scan.next_cursor, items });
    }

    if (action === "migrate_reviews") {
      const pattern = safePattern(req.query.pattern || "gmb:review:*");
      const count = parseIntParam(req.query.count, 100, 1000);
      const limit = parseIntParam(req.query.limit, 20, 500);
      const cursor = safeCursor(req.query.cursor);
      const dryRun = req.query.dry_run !== "false";
      const result = await migrateReviews({ pattern, count, limit, cursor, dryRun });
      return res.status(200).json({ ok: true, temporary: true, action, pattern, limit, ...result });
    }

    return res.status(400).json({ ok: false, error: "unknown_action" });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      error: error.message,
      details: error.details || null,
    });
  }
}
