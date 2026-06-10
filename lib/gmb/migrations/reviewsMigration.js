import { dbQuery } from "../postgres.js";
import { redis, parseRedisJson } from "../../upstash/client.js";
import { scanKeys } from "../../upstash/scan.js";

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

async function upsertReview({ review, tenantId }) {
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

export async function countReviews({ pattern, count }) {
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

export async function countReviewsByTenantPage({ pattern, count, limit, cursor, tenantId }) {
  const scan = await scanKeys({ pattern, count, maxKeys: limit, cursor });
  const tenantCache = new Map();
  let total = 0;
  let unknown_place = 0;
  let failed = 0;

  for (const key of scan.keys) {
    try {
      const raw = await redis(["GET", key]);
      const review = parseRedisJson(raw, "review");
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

  return {
    tenant_id: tenantId,
    cursor,
    next_cursor: scan.next_cursor,
    scanned: scan.keys.length,
    total,
    unknown_place,
    failed,
    done: scan.done,
  };
}

export async function migrateReviews({ pattern, count, limit, cursor, dryRun }) {
  const scan = await scanKeys({ pattern, count, maxKeys: limit, cursor });
  const result = {
    cursor,
    next_cursor: scan.next_cursor,
    scanned: scan.keys.length,
    inserted_or_updated: 0,
    skipped_unknown_place: 0,
    failed: 0,
    dry_run: dryRun,
    done: scan.done,
    errors: [],
  };

  const tenantCache = new Map();

  for (const key of scan.keys) {
    try {
      const raw = await redis(["GET", key]);
      const review = parseRedisJson(raw, "review");

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
        await upsertReview({ review, tenantId });
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
