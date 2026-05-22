import { gmbCaptureKeys } from "./keys.js";
import { redisCommand } from "./redis.js";
import { getPlaceIdsFromPostgres } from "./placesPostgres.js";
import { buildReviewHash, normalizeReview } from "./reviews.js";

const FIELD_MASK = [
  "id",
  "displayName",
  "rating",
  "userRatingCount",
  "primaryType",
  "reviews",
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

function safeJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function getCandidatePlaceIds(date, tenantId) {
  const indexed = safeJson(await redisCommand(["GET", gmbCaptureKeys.index(date, "place_ids", tenantId)])) || [];
  if (indexed.length) return indexed;
  return getPlaceIdsFromPostgres({ tenantId });
}

async function hasReviewCapture(date, placeId, tenantId) {
  const existingReviewKeys = await redisCommand(["GET", gmbCaptureKeys.placeReviewIndex(date, placeId, tenantId)]);
  return Boolean(existingReviewKeys);
}

async function getNextMissingBatch(date, placeIds, limit, tenantId) {
  const batch = [];
  let existing = 0;
  let checked = 0;

  for (const placeId of placeIds) {
    checked += 1;

    if (await hasReviewCapture(date, placeId, tenantId)) {
      existing += 1;
      continue;
    }

    batch.push(placeId);
    if (batch.length >= limit) break;
  }

  return { batch, existing, checked };
}

function getGoogleApiKey() {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
}

async function fetchPlaceWithReviews(placeId) {
  const url = `https://places.googleapis.com/v1/places/${placeId}?languageCode=es`;
  const response = await fetch(url, {
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

function buildSnapshot({ capturedAt, capturedDate, placeId, data, reviewKeys, tenantId }) {
  return {
    tenant_id: tenantId,
    captured_at: capturedAt,
    captured_date: capturedDate,
    place_id: placeId,
    name: data.displayName?.text || null,
    rating: data.rating ?? null,
    review_count: data.userRatingCount ?? 0,
    primary_type: data.primaryType || null,
    visible_reviews_count: reviewKeys.length,
    reviews: reviewKeys,
    source: "google_places_reviews_once",
  };
}

async function saveReviews({ capturedAt, capturedDate, placeId, reviews, tenantId }) {
  const reviewKeys = [];

  for (const review of reviews) {
    const reviewHash = buildReviewHash(placeId, review);
    const normalized = {
      ...normalizeReview({ capturedAt, capturedDate, placeId, reviewHash, review }),
      tenant_id: tenantId,
    };

    const reviewKey = gmbCaptureKeys.review(placeId, reviewHash, tenantId);
    const reviewSeenKey = gmbCaptureKeys.reviewSeen(capturedDate, placeId, reviewHash, tenantId);

    await redisCommand(["SET", reviewKey, JSON.stringify(normalized)]);
    await redisCommand(["SET", reviewSeenKey, "1"]);

    reviewKeys.push(reviewKey);
  }

  await redisCommand(["SET", gmbCaptureKeys.placeReviewIndex(capturedDate, placeId, tenantId), JSON.stringify(reviewKeys)]);

  return reviewKeys;
}

export async function capturePlacesReviews({ limit = 10, tenantId = "cidef" } = {}) {
  const capturedAt = getCapturedAt();
  const capturedDate = getCapturedDate(capturedAt);
  const placeIds = await getCandidatePlaceIds(capturedDate, tenantId);
  const { batch, existing, checked } = await getNextMissingBatch(capturedDate, placeIds, limit, tenantId);

  let saved = 0;
  let failed = 0;
  let reviewsSaved = 0;
  const errors = [];

  for (const placeId of batch) {
    try {
      const data = await fetchPlaceWithReviews(placeId);
      const reviews = data.reviews || [];
      const reviewKeys = await saveReviews({ capturedAt, capturedDate, placeId, reviews, tenantId });
      const snapshot = buildSnapshot({ capturedAt, capturedDate, placeId, data, reviewKeys, tenantId });

      await redisCommand(["SET", gmbCaptureKeys.snapshot(capturedDate, placeId, tenantId), JSON.stringify(snapshot)]);
      saved += 1;
      reviewsSaved += reviewKeys.length;
    } catch (error) {
      failed += 1;
      errors.push({ place_id: placeId, message: error.message, status: error.status || null, details: error.details || null });
      console.error(`Failed capturing reviews for ${placeId}`, error);
    }
  }

  return {
    ok: true,
    tenant_id: tenantId,
    captured_date: capturedDate,
    total: placeIds.length,
    existing,
    checked,
    limit,
    processed: batch.length,
    saved,
    reviews_saved: reviewsSaved,
    failed,
    errors,
    done: batch.length === 0 || existing + saved >= placeIds.length,
  };
}
