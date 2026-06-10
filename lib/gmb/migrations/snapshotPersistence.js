import { dbQuery } from "../postgres.js";

export async function resolveTenantId(placeId) {
  const rows = await dbQuery(
    `select tenant_id from places where place_id = $1 limit 1`,
    [placeId]
  );

  return rows[0]?.tenant_id || null;
}

export async function upsertSnapshot({ snapshot, tenantId }) {
  await dbQuery(
    `insert into place_snapshots (
      tenant_id, place_id, captured_date, captured_at, name,
      rating, review_count, primary_type, source, raw
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
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
      snapshot.place_id,
      snapshot.captured_date,
      snapshot.captured_at || null,
      snapshot.name || null,
      snapshot.rating ?? null,
      snapshot.review_count ?? 0,
      snapshot.primary_type || null,
      snapshot.source || "upstash_snapshot_migration",
      JSON.stringify(snapshot),
    ]
  );
}

export async function upsertMetric({ snapshot, tenantId }) {
  await dbQuery(
    `insert into place_daily_metrics (
      tenant_id, place_id, captured_date, rating,
      review_count, primary_type, updated_at
    ) values ($1,$2,$3,$4,$5,$6,now())
    on conflict (tenant_id, place_id, captured_date)
    do update set
      rating = excluded.rating,
      review_count = excluded.review_count,
      primary_type = excluded.primary_type,
      updated_at = now()`,
    [
      tenantId,
      snapshot.place_id,
      snapshot.captured_date,
      snapshot.rating ?? null,
      snapshot.review_count ?? 0,
      snapshot.primary_type || null,
    ]
  );
}
