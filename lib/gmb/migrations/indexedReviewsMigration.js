import { redis, parseRedisJson } from "../../upstash/client.js";
import { scanAllKeys } from "../../upstash/scan.js";
import { upsertReview } from "./reviewPersistence.js";

function extractIndexDate(key, tenantId) {
  const re = new RegExp(`^gmb:${tenantId}:index:(\\d{4}-\\d{2}-\\d{2}):place:.+:review_keys$`);
  return key.match(re)?.[1] || null;
}

function isAllowedReviewKey({ key, tenantId }) {
  if (typeof key !== "string") return false;

  const escapedTenant = tenantId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^gmb:${escapedTenant}:review:[^:]+:[0-9a-f]{40}$`);
  return re.test(key);
}

function createResult({ tenantId, date, offsetIndexes, limitIndexes, maxIndexes, dryRun, discovery }) {
  return {
    tenant_id: tenantId,
    date,
    dry_run: dryRun,
    offset_indexes: offsetIndexes,
    limit_indexes: limitIndexes,
    max_indexes: maxIndexes,
    discovery,
    indexes_scanned: 0,
    reviews_seen: 0,
    inserted_or_updated: 0,
    skipped_bad_key: 0,
    skipped_other_tenant: 0,
    failed: 0,
    next_offset_indexes: offsetIndexes,
    done: false,
    errors: [],
  };
}

function addError(result, key, error) {
  result.failed += 1;
  if (result.errors.length < 20) {
    result.errors.push({ key, error: error.message });
  }
}

function validateReview(review) {
  if (!review.place_id) throw new Error("missing_place_id");
  if (!review.review_hash) throw new Error("missing_review_hash");
  if (!review.captured_date) throw new Error("missing_captured_date");
}

async function discoverIndexes({ tenantId, date, maxIndexes }) {
  const pattern = date
    ? `gmb:${tenantId}:index:${date}:place:*:review_keys`
    : `gmb:${tenantId}:index:*:place:*:review_keys`;

  const scan = await scanAllKeys({ pattern, count: 1000, maxKeys: maxIndexes });
  const dates = scan.keys.map((key) => extractIndexDate(key, tenantId)).filter(Boolean);

  return {
    pattern,
    indexes_found: scan.keys.length,
    dates: Array.from(new Set(dates)).sort(),
    scan_complete: scan.complete,
    scan_cursor: scan.cursor,
    scan_iterations: scan.iterations,
    keys: scan.keys,
  };
}

async function processReviewKey({ reviewKey, tenantId, dryRun, result }) {
  result.reviews_seen += 1;

  if (!isAllowedReviewKey({ key: reviewKey, tenantId })) {
    result.skipped_bad_key += 1;
    return;
  }

  const raw = await redis(["GET", reviewKey]);
  const review = parseRedisJson(raw, "review");
  validateReview(review);

  if (review.tenant_id && review.tenant_id !== tenantId) {
    result.skipped_other_tenant += 1;
    return;
  }

  if (!dryRun) {
    await upsertReview({ review, tenantId });
  }

  result.inserted_or_updated += 1;
}

async function processIndex({ indexKey, tenantId, dryRun, result }) {
  const raw = await redis(["GET", indexKey]);
  const reviewKeys = parseRedisJson(raw, "review_keys");

  if (!Array.isArray(reviewKeys)) {
    throw new Error("review_keys_not_array");
  }

  for (const reviewKey of reviewKeys) {
    try {
      await processReviewKey({ reviewKey, tenantId, dryRun, result });
    } catch (error) {
      addError(result, reviewKey, error);
    }
  }
}

export async function migrateIndexedReviews({
  tenantId,
  date,
  offsetIndexes,
  limitIndexes,
  maxIndexes,
  dryRun,
}) {
  const discovery = await discoverIndexes({ tenantId, date, maxIndexes });
  const batch = discovery.keys.slice(offsetIndexes, offsetIndexes + limitIndexes);
  const result = createResult({
    tenantId,
    date,
    offsetIndexes,
    limitIndexes,
    maxIndexes,
    dryRun,
    discovery,
  });

  for (const indexKey of batch) {
    try {
      await processIndex({ indexKey, tenantId, dryRun, result });
      result.indexes_scanned += 1;
    } catch (error) {
      addError(result, indexKey, error);
    }
  }

  result.next_offset_indexes = offsetIndexes + batch.length;
  result.done = result.next_offset_indexes >= discovery.keys.length && discovery.scan_complete;
  delete result.discovery.keys;

  return result;
}
