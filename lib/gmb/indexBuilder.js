import { redisCommand } from "./redis.js";
import { buildLocationIndexes } from "./locationIndexes.js";
import { gmbCaptureKeys } from "./keys.js";

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function scanKeys(pattern) {
  let cursor = "0";
  const keys = [];

  do {
    const result = await redisCommand(["SCAN", cursor, "MATCH", pattern, "COUNT", "200"]);
    cursor = String(result?.[0] || "0");
    keys.push(...(result?.[1] || []));
  } while (cursor !== "0");

  return keys;
}

function snapshotPlaceId(date, key, tenantId) {
  return key.replace(gmbCaptureKeys.snapshot(date, "", tenantId), "");
}

function reviewSeenParts(date, key, tenantId) {
  const raw = key.replace(gmbCaptureKeys.reviewSeen(date, "", "", tenantId), "");
  const parts = raw.split(":");
  const reviewHash = parts.pop();
  const placeId = parts.join(":");
  return { placeId, reviewHash };
}

function reviewKeyFromSeen(date, key, tenantId) {
  const { placeId, reviewHash } = reviewSeenParts(date, key, tenantId);
  return gmbCaptureKeys.review(placeId, reviewHash, tenantId);
}

function groupReviewsByPlace(date, reviewSeenKeys, tenantId) {
  const grouped = {};

  for (const seenKey of reviewSeenKeys) {
    const { placeId } = reviewSeenParts(date, seenKey, tenantId);
    const reviewKey = reviewKeyFromSeen(date, seenKey, tenantId);

    if (!grouped[placeId]) grouped[placeId] = [];
    grouped[placeId].push(reviewKey);
  }

  return grouped;
}

export async function buildGmbIndexes({ date = today(), tenantId = "cidef" } = {}) {
  const snapshotKeys = await scanKeys(gmbCaptureKeys.snapshot(date, "*", tenantId));
  const reviewSeenKeys = await scanKeys(gmbCaptureKeys.reviewSeen(date, "*", "*", tenantId));
  const reviewKeys = reviewSeenKeys.map((key) => reviewKeyFromSeen(date, key, tenantId));
  const placeIds = snapshotKeys.map((key) => snapshotPlaceId(date, key, tenantId));
  const reviewsByPlace = groupReviewsByPlace(date, reviewSeenKeys, tenantId);
  const locationIndexes = await buildLocationIndexes(date, { tenantId });

  await redisCommand(["SET", gmbCaptureKeys.index(date, "snapshot_keys", tenantId), JSON.stringify(snapshotKeys)]);
  await redisCommand(["SET", gmbCaptureKeys.index(date, "place_ids", tenantId), JSON.stringify(placeIds)]);
  await redisCommand(["SET", gmbCaptureKeys.index(date, "review_keys", tenantId), JSON.stringify(reviewKeys)]);
  await redisCommand(["SET", gmbCaptureKeys.index(date, "review_seen_keys", tenantId), JSON.stringify(reviewSeenKeys)]);

  for (const [placeId, keys] of Object.entries(reviewsByPlace)) {
    await redisCommand(["SET", gmbCaptureKeys.placeReviewIndex(date, placeId, tenantId), JSON.stringify(keys)]);
  }

  return {
    ok: true,
    tenant_id: tenantId,
    date,
    snapshots: snapshotKeys.length,
    places: placeIds.length,
    reviews: reviewKeys.length,
    review_seen: reviewSeenKeys.length,
    places_with_reviews: Object.keys(reviewsByPlace).length,
    locations: locationIndexes.locations,
    ranked_locations: locationIndexes.ranked_locations,
    role_locations: locationIndexes.role_locations,
  };
}
