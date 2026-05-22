import { redisCommand } from "../../../lib/gmb/redis.js";
import { dbQuery } from "../../../lib/gmb/postgres.js";
import { resolvePlacesFromPostgres } from "../../../lib/gmb/placeResolver.js";
import { gmbCaptureKeys } from "../../../lib/gmb/keys.js";

function safeJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function todayChile() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const date = req.query.date || todayChile();
  const tenantId = req.query.tenant_id || req.query.tenant || "cidef";

  try {
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

    return res.status(200).json({
      ok: true,
      tenant_id: tenantId,
      date,
      total_places: places.length,
      inserted,
      missing,
      failed,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      error: "place_daily_metrics_backfill_failed",
      message: error.message,
    });
  }
}
