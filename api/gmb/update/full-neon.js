import crypto from "crypto";
import { dbQuery } from "../../../lib/gmb/postgres.js";

const FIELD_MASK = [
  "id",
  "displayName",
  "rating",
  "userRatingCount",
  "primaryType",
  "reviews",
].join(",");

function todayChile() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function requireTenantId(req) {
  const tenantId = req.query.tenant_id || req.query.tenant;
  return typeof tenantId === "string" && tenantId.trim() ? tenantId.trim() : null;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getGoogleApiKey() {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
}

function buildReviewHash(placeId, review) {
  const raw = [
    placeId,
    review.authorAttribution?.displayName || "",
    review.rating || "",
    review.publishTime || "",
  ].join("|");

  return crypto.createHash("sha1").update(raw).digest("hex");
}

async function createRun({ tenantId, date, limit, pauseMs, maxBatches }) {
  const rows = await dbQuery(
    `insert into capture_runs (
      tenant_id,
      mode,
      captured_date,
      status,
      metadata
    ) values ($1,$2,$3,$4,$5)
    returning id`,
    [
      tenantId,
      "full-neon",
      date,
      "running",
      JSON.stringify({ limit, pause_ms: pauseMs, max_batches: maxBatches, endpoint: "/api/gmb/update/full-neon" }),
    ]
  );

  return rows[0]?.id;
}

async function finishRun({ runId, status, totalPlaces, processed, saved, failed, reviewsSaved, errors }) {
  await dbQuery(
    `update capture_runs
     set finished_at = now(),
         status = $2,
         total_places = $3,
         processed = $4,
         saved = $5,
         failed = $6,
         reviews_saved = $7,
         errors = $8
     where id = $1`,
    [runId, status, totalPlaces, processed, saved, failed, reviewsSaved, JSON.stringify(errors.slice(0, 50))]
  );
}

async function readPlaces({ tenantId }) {
  return dbQuery(
    `select place_id
     from places
     where tenant_id = $1
       and coalesce(status, 'keep') = 'keep'
     order by place_id`,
    [tenantId]
  );
}

async function readExistingSnapshotIds({ tenantId, date }) {
  const rows = await dbQuery(
    `select place_id
     from place_snapshots
     where tenant_id = $1
       and captured_date = $2
       and source = 'google_places_full_neon'`,
    [tenantId, date]
  );

  return new Set(rows.map((row) => row.place_id));
}

async function fetchPlace(placeId) {
  const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=es`, {
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

async function upsertSnapshot({ tenantId, placeId, date, data }) {
  await dbQuery(
    `insert into place_snapshots (
      tenant_id,
      place_id,
      captured_date,
      captured_at,
      name,
      rating,
      review_count,
      primary_type,
      source,
      raw
    ) values ($1,$2,$3,now(),$4,$5,$6,$7,$8,$9)
    on conflict (tenant_id, place_id, captured_date)
    do update set
      captured_at = excluded.captured_at,
      name = excluded.name,
      rating = excluded.rating,
      review_count = excluded.review_count,
      primary_type = excluded.primary_type,
      source = excluded.source,
      raw = excluded.raw`,
    [
      tenantId,
      placeId,
      date,
      data.displayName?.text || null,
      data.rating ?? null,
      data.userRatingCount ?? 0,
      data.primaryType || null,
      "google_places_full_neon",
      JSON.stringify(data),
    ]
  );
}

async function upsertMetric({ tenantId, placeId, date, data }) {
  await dbQuery(
    `insert into place_daily_metrics (
      tenant_id,
      place_id,
      captured_date,
      rating,
      review_count,
      primary_type,
      updated_at
    ) values ($1,$2,$3,$4,$5,$6,now())
    on conflict (tenant_id, place_id, captured_date)
    do update set
      rating = excluded.rating,
      review_count = excluded.review_count,
      primary_type = excluded.primary_type,
      updated_at = now()`,
    [
      tenantId,
      placeId,
      date,
      data.rating ?? null,
      data.userRatingCount ?? 0,
      data.primaryType || null,
    ]
  );
}

async function upsertReviews({ tenantId, placeId, date, reviews }) {
  let saved = 0;

  for (const review of reviews || []) {
    const reviewHash = buildReviewHash(placeId, review);

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
      ) values ($1,$2,$3,$4,now(),now(),$5,$6,$7,$8,$9,$10,$11,$12,$13)
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
        placeId,
        reviewHash,
        date,
        review.authorAttribution?.displayName || null,
        review.publishTime || null,
        review.rating || null,
        review.text?.text || null,
        review.text?.languageCode || null,
        review.originalText?.text || null,
        review.originalText?.languageCode || null,
        "google_places_full_neon",
        JSON.stringify(review),
      ]
    );

    saved += 1;
  }

  return saved;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  if (req.query.confirm !== "true") {
    return res.status(400).json({ ok: false, error: "confirm_required" });
  }

  const tenantId = requireTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ ok: false, error: "tenant_id_required" });
  }

  if (!getGoogleApiKey()) {
    return res.status(500).json({ ok: false, error: "google_api_key_missing" });
  }

  const date = req.query.date || todayChile();
  const limit = parsePositiveInt(req.query.limit, 10);
  const pauseMs = parsePositiveInt(req.query.pause_ms, 5000);
  const maxBatches = parsePositiveInt(req.query.max_batches, 1);

  const batches = [];
  const allErrors = [];
  const attemptedSet = new Set();
  let processed = 0;
  let saved = 0;
  let failed = 0;
  let reviewsSaved = 0;
  let runId = null;

  try {
    const places = await readPlaces({ tenantId });
    runId = await createRun({ tenantId, date, limit, pauseMs, maxBatches });

    const existingSet = await readExistingSnapshotIds({ tenantId, date });
    let pending = places.filter((place) => !existingSet.has(place.place_id));

    for (let batchNumber = 1; batchNumber <= maxBatches && pending.length > 0; batchNumber += 1) {
      const batch = pending.slice(0, limit);
      let batchSaved = 0;
      let batchFailed = 0;
      let batchReviewsSaved = 0;
      const batchErrors = [];

      for (const place of batch) {
        attemptedSet.add(place.place_id);
        processed += 1;
        try {
          const data = await fetchPlace(place.place_id);
          await upsertSnapshot({ tenantId, placeId: place.place_id, date, data });
          await upsertMetric({ tenantId, placeId: place.place_id, date, data });
          const reviewCount = await upsertReviews({ tenantId, placeId: place.place_id, date, reviews: data.reviews || [] });
          existingSet.add(place.place_id);
          saved += 1;
          batchSaved += 1;
          reviewsSaved += reviewCount;
          batchReviewsSaved += reviewCount;
        } catch (error) {
          failed += 1;
          batchFailed += 1;
          const item = {
            place_id: place.place_id,
            message: error.message,
            status: error.status || null,
            details: error.details || null,
          };
          batchErrors.push(item);
          allErrors.push(item);
        }
      }

      pending = places.filter((place) => !existingSet.has(place.place_id) && !attemptedSet.has(place.place_id));

      batches.push({
        batch: batchNumber,
        processed: batch.length,
        saved: batchSaved,
        failed: batchFailed,
        reviews_saved: batchReviewsSaved,
        remaining_unattempted: pending.length,
        done: pending.length === 0,
        errors: batchErrors.slice(0, 5),
      });

      if (pending.length === 0) break;
      await sleep(pauseMs);
    }

    const remainingUnattempted = pending.length;
    const done = remainingUnattempted === 0;
    const status = !done ? "incomplete" : failed > 0 ? "partial" : "done";
    await finishRun({ runId, status, totalPlaces: places.length, processed, saved, failed, reviewsSaved, errors: allErrors });

    return res.status(200).json({
      ok: done && failed === 0,
      status,
      tenant_id: tenantId,
      date,
      run_id: runId,
      total_places: places.length,
      processed,
      saved,
      failed,
      reviews_saved: reviewsSaved,
      missing: places.length - existingSet.size,
      remaining_unattempted: remainingUnattempted,
      done,
      runtime_ready: saved > 0 || existingSet.size > 0,
      evidence_ready: reviewsSaved > 0,
      batches,
      flow: "Google Places full -> Neon place_snapshots + place_daily_metrics + place_reviews",
    });
  } catch (error) {
    if (runId) {
      await finishRun({ runId, status: "failed", totalPlaces: 0, processed, saved, failed: failed + 1, reviewsSaved, errors: [...allErrors, { message: error.message }] });
    }

    console.error("full neon update failed", error);
    return res.status(500).json({
      ok: false,
      error: "full_neon_update_failed",
      message: error.message,
      tenant_id: tenantId,
      date,
      run_id: runId,
      batches,
    });
  }
}
