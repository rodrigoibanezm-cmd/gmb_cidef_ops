import { redis } from "../../../lib/upstash/client.js";
import { scanKeys } from "../../../lib/upstash/scan.js";
import {
  parseIntParam,
  parseOffset,
  safeCursor,
  safeGmbKey,
  safeOptionalDate,
  safeReviewPattern,
  safeTenantId,
} from "../../../lib/upstash/safety.js";
import {
  countReviews,
  countReviewsByTenantPage,
  migrateReviews,
} from "../../../lib/gmb/migrations/reviewsMigration.js";
import { migrateSnapshots } from "../../../lib/gmb/migrations/snapshotsMigration.js";

function authorized(req) {
  const expected = process.env.CRON_SECRET;
  const provided = req.query.token || req.headers["x-cron-secret"];
  return Boolean(expected && provided && provided === expected);
}

function asPreview(value, maxChars) {
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  return {
    length: raw.length,
    preview: raw.length > maxChars ? `${raw.slice(0, maxChars)}...` : raw,
  };
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

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  if (!authorized(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const action = req.query.action || "scan";

  try {
    if (action === "scan") {
      const pattern = safeReviewPattern(req.query.pattern);
      const count = parseIntParam(req.query.count, 100, 1000);
      const maxKeys = parseIntParam(req.query.max_keys, 100, 500);
      const cursor = safeCursor(req.query.cursor);
      const scan = await scanKeys({ pattern, count, maxKeys, cursor });
      return res.status(200).json({ ok: true, temporary: true, action, pattern, cursor, ...scan });
    }

    if (action === "count_reviews") {
      const pattern = safeReviewPattern(req.query.pattern || "gmb:review:*");
      const count = parseIntParam(req.query.count, 1000, 5000);
      const result = await countReviews({ pattern, count });
      return res.status(200).json({ ok: true, temporary: true, action, pattern, ...result });
    }

    if (action === "count_reviews_by_tenant") {
      const tenantId = safeTenantId(req.query.tenant_id || req.query.tenant);
      const pattern = safeReviewPattern(req.query.pattern || "gmb:review:*");
      const count = parseIntParam(req.query.count, 100, 1000);
      const limit = parseIntParam(req.query.limit, 100, 1000);
      const cursor = safeCursor(req.query.cursor);
      const result = await countReviewsByTenantPage({ pattern, count, limit, cursor, tenantId });
      return res.status(200).json({ ok: true, temporary: true, action, pattern, limit, ...result });
    }

    if (action === "get") {
      const key = safeGmbKey(req.query.key);
      const maxChars = parseIntParam(req.query.max_chars, 1200, 10000);
      const item = await inspectKey(key, maxChars);
      return res.status(200).json({ ok: true, temporary: true, action, item });
    }

    if (action === "preview") {
      const pattern = safeReviewPattern(req.query.pattern);
      const count = parseIntParam(req.query.count, 100, 1000);
      const maxKeys = parseIntParam(req.query.max_keys, 20, 50);
      const cursor = safeCursor(req.query.cursor);
      const maxChars = parseIntParam(req.query.max_chars, 1200, 10000);
      const scan = await scanKeys({ pattern, count, maxKeys, cursor });
      const items = [];

      for (const key of scan.keys) {
        items.push(await inspectKey(key, maxChars));
      }

      return res.status(200).json({ ok: true, temporary: true, action, pattern, cursor, next_cursor: scan.next_cursor, items });
    }

    if (action === "migrate_reviews") {
      const pattern = safeReviewPattern(req.query.pattern || "gmb:review:*");
      const count = parseIntParam(req.query.count, 100, 1000);
      const limit = parseIntParam(req.query.limit, 20, 500);
      const cursor = safeCursor(req.query.cursor);
      const dryRun = req.query.dry_run !== "false";
      const result = await migrateReviews({ pattern, count, limit, cursor, dryRun });
      return res.status(200).json({ ok: true, temporary: true, action, pattern, limit, ...result });
    }

    if (action === "migrate_snapshots") {
      const tenantId = safeTenantId(req.query.tenant_id || req.query.tenant);
      const date = safeOptionalDate(req.query.date || req.query.captured_date);
      const offsetPerDate = parseOffset(req.query.offset_per_date || req.query.offset);
      const limitPerDate = parseIntParam(req.query.limit_per_date || req.query.limit, 100, 1000);
      const limitDates = parseIntParam(req.query.limit_dates, 10, 50);
      const dryRun = req.query.dry_run !== "false";
      const result = await migrateSnapshots({ tenantId, date, offsetPerDate, limitPerDate, limitDates, dryRun });
      return res.status(200).json({ ok: true, temporary: true, action, ...result });
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
