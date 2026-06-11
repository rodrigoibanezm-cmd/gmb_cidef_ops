import { redis, parseRedisJson } from "../../upstash/client.js";
import { scanKeys } from "../../upstash/scan.js";
import { resolveTenantId, upsertReview } from "./reviewPersistence.js";

function createCountResult({ cursor }) {
  return {
    cursor,
    next_cursor: "0",
    done: false,
    scanned: 0,
    counted: 0,
    failed: 0,
    errors: [],
  };
}

function createTenantCountResult({ tenantId, cursor }) {
  return {
    tenant_id: tenantId,
    cursor,
    next_cursor: "0",
    done: false,
    scanned: 0,
    matched_tenant: 0,
    skipped_other_tenant: 0,
    skipped_unknown_place: 0,
    failed: 0,
    errors: [],
  };
}

function createMigrationResult({ tenantId, cursor, dryRun }) {
  return {
    tenant_id: tenantId || null,
    cursor,
    next_cursor: "0",
    done: false,
    dry_run: dryRun,
    scanned: 0,
    inserted_or_updated: 0,
    skipped_other_tenant: 0,
    skipped_unknown_place: 0,
    failed: 0,
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

async function loadReview(key) {
  const raw = await redis(["GET", key]);
  const review = parseRedisJson(raw, "review");
  validateReview(review);
  return review;
}

async function resolveReviewTenant({ review, tenantCache }) {
  if (tenantCache.has(review.place_id)) return tenantCache.get(review.place_id);

  const tenantId = await resolveTenantId(review.place_id);
  tenantCache.set(review.place_id, tenantId);
  return tenantId;
}

function applyTenantFilter({ result, requestedTenantId, resolvedTenantId }) {
  if (!resolvedTenantId) {
    result.skipped_unknown_place += 1;
    return false;
  }

  if (requestedTenantId && resolvedTenantId !== requestedTenantId) {
    result.skipped_other_tenant += 1;
    return false;
  }

  return true;
}

export async function countReviews({ pattern, count }) {
  let cursor = "0";
  const result = createCountResult({ cursor });

  do {
    const scan = await scanKeys({ pattern, count, maxKeys: count, cursor });
    result.scanned += scan.keys.length;
    result.counted += scan.keys.length;
    cursor = scan.next_cursor;
    result.next_cursor = cursor;
    result.done = scan.done;
  } while (cursor !== "0");

  return result;
}

export async function countReviewsByTenantPage({ pattern, count, limit, cursor, tenantId }) {
  const result = createTenantCountResult({ tenantId, cursor });
  const tenantCache = new Map();
  const scan = await scanKeys({ pattern, count, maxKeys: limit, cursor });

  result.scanned = scan.keys.length;
  result.next_cursor = scan.next_cursor;
  result.done = scan.done;

  for (const key of scan.keys) {
    try {
      const review = await loadReview(key);
      const resolvedTenantId = await resolveReviewTenant({ review, tenantCache });

      if (!resolvedTenantId) {
        result.skipped_unknown_place += 1;
      } else if (resolvedTenantId === tenantId) {
        result.matched_tenant += 1;
      } else {
        result.skipped_other_tenant += 1;
      }
    } catch (error) {
      addError(result, key, error);
    }
  }

  return result;
}

export async function migrateReviews({ pattern, count, limit, cursor, dryRun, tenantId = null }) {
  const result = createMigrationResult({ tenantId, cursor, dryRun });
  const tenantCache = new Map();
  const scan = await scanKeys({ pattern, count, maxKeys: limit, cursor });

  result.scanned = scan.keys.length;
  result.next_cursor = scan.next_cursor;
  result.done = scan.done;

  for (const key of scan.keys) {
    try {
      const review = await loadReview(key);
      const resolvedTenantId = await resolveReviewTenant({ review, tenantCache });

      if (!applyTenantFilter({ result, requestedTenantId: tenantId, resolvedTenantId })) {
        continue;
      }

      if (!dryRun) {
        await upsertReview({ review, tenantId: resolvedTenantId });
      }

      result.inserted_or_updated += 1;
    } catch (error) {
      addError(result, key, error);
    }
  }

  return result;
}
