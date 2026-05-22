import { gmbCaptureKeys } from "./keys.js";
import { getPlaceIdsFromPostgres } from "./placesPostgres.js";
import { redisCommand } from "./redis.js";

const FIELD_MASK = [
  "id",
  "displayName",
  "rating",
  "userRatingCount",
  "primaryType",
].join(",");

function getCapturedAt() {
  return new Date().toISOString();
}

function getCapturedDate(capturedAt) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(capturedAt));
}

async function scanKeys(pattern) {
  let cursor = "0";
  const keys = [];

  do {
    const result = await redisCommand(["SCAN", cursor, "MATCH", pattern, "COUNT", "500"]);
    cursor = String(result?.[0] || "0");
    keys.push(...(result?.[1] || []));
  } while (cursor !== "0");

  return keys;
}

function snapshotPlaceId(date, key, tenantId) {
  return key.replace(gmbCaptureKeys.snapshot(date, "", tenantId), "");
}

async function getMissingPlaceIds(date, placeIds, tenantId) {
  const snapshotKeys = await scanKeys(gmbCaptureKeys.snapshot(date, "*", tenantId));
  const existingPlaceIds = new Set(snapshotKeys.map((key) => snapshotPlaceId(date, key, tenantId)));
  return placeIds.filter((placeId) => !existingPlaceIds.has(placeId));
}

function getGoogleApiKey() {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
}

async function fetchPlace(placeId) {
  const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": getGoogleApiKey(),
      "X-Goog-FieldMask": FIELD_MASK,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    const error = new Error(`Google Places error: ${response.status}`);
    error.status = response.status;
    error.details = details.slice(0, 300);
    throw error;
  }

  return response.json();
}

function buildSnapshot({ capturedAt, capturedDate, placeId, data, tenantId }) {
  return {
    tenant_id: tenantId,
    captured_at: capturedAt,
    captured_date: capturedDate,
    place_id: placeId,
    name: data.displayName?.text || null,
    rating: data.rating ?? null,
    review_count: data.userRatingCount ?? 0,
    primary_type: data.primaryType || null,
    source: "google_places_demo_no_reviews",
  };
}

export async function capturePlacesDemo({ limit = 25, offset = 0, tenantId = "cidef" } = {}) {
  const capturedAt = getCapturedAt();
  const capturedDate = getCapturedDate(capturedAt);
  const placeIds = await getPlaceIdsFromPostgres({ tenantId });
  const missingPlaceIds = await getMissingPlaceIds(capturedDate, placeIds, tenantId);
  const batch = missingPlaceIds.slice(offset, offset + limit);

  let ok = 0;
  let failed = 0;
  const errors = [];

  for (const placeId of batch) {
    try {
      const data = await fetchPlace(placeId);
      const snapshot = buildSnapshot({ capturedAt, capturedDate, placeId, data, tenantId });
      const key = gmbCaptureKeys.snapshot(capturedDate, placeId, tenantId);

      await redisCommand(["SET", key, JSON.stringify(snapshot)]);
      ok += 1;
    } catch (error) {
      failed += 1;
      errors.push({
        place_id: placeId,
        message: error.message,
        status: error.status || null,
        details: error.details || null,
      });
      console.error(`Failed capturing place ${placeId}`, error);
    }
  }

  return {
    ok: true,
    tenant_id: tenantId,
    captured_date: capturedDate,
    total: placeIds.length,
    existing: placeIds.length - missingPlaceIds.length,
    missing: missingPlaceIds.length,
    offset,
    limit,
    processed: batch.length,
    saved: ok,
    failed,
    errors,
    next_offset: offset + batch.length,
    done: offset + batch.length >= missingPlaceIds.length,
  };
}
