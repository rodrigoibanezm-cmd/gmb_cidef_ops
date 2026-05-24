import { capturePlacesReviews } from "../../../lib/gmb/capturePlacesReviews.js";
import { buildGmbIndexes } from "../../../lib/gmb/indexBuilder.js";
import { redisCommand } from "../../../lib/gmb/redis.js";
import { dbQuery } from "../../../lib/gmb/postgres.js";
import { resolvePlacesFromPostgres } from "../../../lib/gmb/placeResolver.js";
import { gmbCaptureKeys } from "../../../lib/gmb/keys.js";

function todayChile() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function upsertMetric({ tenantId, place, date, snapshot }) {
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
      place.place_id,
      date,
      snapshot.rating ?? null,
      snapshot.review_count ?? snapshot.reviews_count ?? 0,
      snapshot.primary_type ?? null,
    ]
  );
}

async function backfillPlaceDailyMetrics({ tenantId, date }) {
  const places = await resolvePlacesFromPostgres({
    tenant_id: tenantId,
    filters: { tenant_id: tenantId, status: "keep" },
  });

  let inserted = 0;
  let missing = 0;
  let failed = 0;
  const errors = [];

  for (const place of places) {
    try {
      const key = gmbCaptureKeys.snapshot(date, place.place_id, tenantId);
      const snapshot = safeJson(await redisCommand(["GET", key]));
      if (!snapshot) {
        missing += 1;
        continue;
      }
      await upsertMetric({ tenantId, place, date, snapshot });
      inserted += 1;
    } catch (error) {
      failed += 1;
      errors.push({ place_id: place.place_id, message: error.message });
    }
  }

  return {
    ok: true,
    tenant_id: tenantId,
    date,
    total_places: places.length,
    inserted,
    missing,
    failed,
    errors: errors.slice(0, 20),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  if (req.query.confirm !== "true") {
    return res.status(400).json({
      ok: false,
      error: "confirm_required",
      message: "Full update captures Google Places reviews. Add confirm=true.",
    });
  }

  const tenantId = req.query.tenant_id || req.query.tenant || "cidef";
  const limit = parsePositiveInt(req.query.limit, 10);
  const pauseMs = parsePositiveInt(req.query.pause_ms, 5000);
  const maxBatches = parsePositiveInt(req.query.max_batches, 100);

  const batches = [];
  let done = false;
  let date = todayChile();

  try {
    for (let batchNumber = 1; batchNumber <= maxBatches; batchNumber += 1) {
      const result = await capturePlacesReviews({ limit, tenantId });
      date = result.captured_date;
      batches.push({
        batch: batchNumber,
        processed: result.processed,
        saved: result.saved,
        reviews_saved: result.reviews_saved,
        failed: result.failed,
        existing: result.existing,
        checked: result.checked,
        done: result.done,
        errors: result.errors?.slice(0, 5) || [],
      });

      done = Boolean(result.done);
      if (done) break;
      await sleep(pauseMs);
    }

    if (!done) {
      return res.status(200).json({
        ok: false,
        error: "max_batches_reached",
        tenant_id: tenantId,
        date,
        limit,
        pause_ms: pauseMs,
        done,
        batches,
      });
    }

    const index = await buildGmbIndexes({ date, tenantId });
    const backfill = await backfillPlaceDailyMetrics({ tenantId, date });

    return res.status(200).json({
      ok: true,
      tenant_id: tenantId,
      date,
      limit,
      pause_ms: pauseMs,
      done,
      batches,
      index,
      backfill,
      flow: "Redis snapshot completo + reviews -> Redis index -> Neon runtime",
    });
  } catch (error) {
    console.error("full update failed", error);
    return res.status(500).json({
      ok: false,
      error: "full_update_failed",
      message: error.message,
      tenant_id: tenantId,
      date,
      batches,
    });
  }
}
