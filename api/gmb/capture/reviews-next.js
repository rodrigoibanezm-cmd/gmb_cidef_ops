import { scanKeys } from "../../../lib/upstash/scan.js";
import { inspectKey } from "../../../lib/upstash/inspect.js";
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

async function handleScan(req, res) {
  const pattern = safeReviewPattern(req.query.pattern);
  const count = parseIntParam(req.query.count, 100, 1000);
  const maxKeys = parseIntParam(req.query.max_keys, 100, 500);
  const cursor = safeCursor(req.query.cursor);
  const scan = await scanKeys({ pattern, count, maxKeys, cursor });

  return res.status(200).json({ ok: true, temporary: true, action: "scan", pattern, cursor, ...scan });
}

async function handlePreview(req, res) {
  const pattern = safeReviewPattern(req.query.pattern);
  const count = parseIntParam(req.query.count, 100, 1000);
  const maxKeys = parseIntParam(req.query.max_keys, 20, 50);
  const cursor = safeCursor(req.query.cursor);
  const maxChars = parseIntParam(req.query.max_chars, 1200, 10000);
  const scan = await scanKeys({ pattern, count, maxKeys, cursor });
  const items = [];

  for (const key of scan.keys) items.push(await inspectKey(key, maxChars));

  return res.status(200).json({
    ok: true,
    temporary: true,
    action: "preview",
    pattern,
    cursor,
    next_cursor: scan.next_cursor,
    items,
  });
}

async function handlePreviewSnapshotIndexes(req, res) {
  const tenantId = safeTenantId(req.query.tenant_id || req.query.tenant);
  const count = parseIntParam(req.query.count, 100, 1000);
  const maxKeys = parseIntParam(req.query.max_keys || req.query.limit, 3, 50);
  const cursor = safeCursor(req.query.cursor);
  const maxChars = parseIntParam(req.query.max_chars, 3000, 10000);
  const pattern = `gmb:${tenantId}:index:*:snapshot_keys`;
  const scan = await scanKeys({ pattern, count, maxKeys, cursor });
  const items = [];

  for (const key of scan.keys) items.push(await inspectKey(key, maxChars));

  return res.status(200).json({
    ok: true,
    temporary: true,
    action: "preview_snapshot_indexes",
    tenant_id: tenantId,
    pattern,
    cursor,
    next_cursor: scan.next_cursor,
    done: scan.done,
    items,
  });
}

async function handleCountReviews(req, res) {
  const pattern = safeReviewPattern(req.query.pattern || "gmb:review:*");
  const count = parseIntParam(req.query.count, 1000, 5000);
  const result = await countReviews({ pattern, count });

  return res.status(200).json({ ok: true, temporary: true, action: "count_reviews", pattern, ...result });
}

async function handleCountReviewsByTenant(req, res) {
  const tenantId = safeTenantId(req.query.tenant_id || req.query.tenant);
  const pattern = safeReviewPattern(req.query.pattern || "gmb:review:*");
  const count = parseIntParam(req.query.count, 100, 1000);
  const limit = parseIntParam(req.query.limit, 100, 1000);
  const cursor = safeCursor(req.query.cursor);
  const result = await countReviewsByTenantPage({ pattern, count, limit, cursor, tenantId });

  return res.status(200).json({
    ok: true,
    temporary: true,
    action: "count_reviews_by_tenant",
    pattern,
    limit,
    ...result,
  });
}

async function handleGet(req, res) {
  const key = safeGmbKey(req.query.key);
  const maxChars = parseIntParam(req.query.max_chars, 1200, 10000);
  const item = await inspectKey(key, maxChars);

  return res.status(200).json({ ok: true, temporary: true, action: "get", item });
}

async function handleMigrateReviews(req, res) {
  const tenantId = req.query.tenant_id || req.query.tenant
    ? safeTenantId(req.query.tenant_id || req.query.tenant)
    : null;
  const pattern = safeReviewPattern(req.query.pattern || "gmb:review:*");
  const count = parseIntParam(req.query.count, 100, 1000);
  const limit = parseIntParam(req.query.limit, 20, 500);
  const cursor = safeCursor(req.query.cursor);
  const dryRun = req.query.dry_run !== "false";
  const result = await migrateReviews({ pattern, count, limit, cursor, dryRun, tenantId });

  return res.status(200).json({
    ok: true,
    temporary: true,
    action: "migrate_reviews",
    tenant_id: tenantId,
    pattern,
    limit,
    ...result,
  });
}

async function handleMigrateSnapshots(req, res) {
  const tenantId = safeTenantId(req.query.tenant_id || req.query.tenant);
  const date = safeOptionalDate(req.query.date || req.query.captured_date);
  const offsetPerDate = parseOffset(req.query.offset_per_date || req.query.offset);
  const limitPerDate = parseIntParam(req.query.limit_per_date || req.query.limit, 100, 1000);
  const limitDates = parseIntParam(req.query.limit_dates, 10, 50);
  const dryRun = req.query.dry_run !== "false";
  const result = await migrateSnapshots({ tenantId, date, offsetPerDate, limitPerDate, limitDates, dryRun });

  return res.status(200).json({ ok: true, temporary: true, action: "migrate_snapshots", ...result });
}

const handlers = {
  scan: handleScan,
  preview: handlePreview,
  preview_snapshot_indexes: handlePreviewSnapshotIndexes,
  count_reviews: handleCountReviews,
  count_reviews_by_tenant: handleCountReviewsByTenant,
  get: handleGet,
  migrate_reviews: handleMigrateReviews,
  migrate_snapshots: handleMigrateSnapshots,
};

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  if (!authorized(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  try {
    const action = req.query.action || "scan";
    const actionHandler = handlers[action];

    if (!actionHandler) {
      return res.status(400).json({ ok: false, error: "unknown_action" });
    }

    return actionHandler(req, res);
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      error: error.message,
      details: error.details || null,
    });
  }
}
