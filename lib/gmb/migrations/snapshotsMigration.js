import { dbQuery } from "../postgres.js";
import { redis, parseRedisJson } from "../../upstash/client.js";
import { scanAllKeys } from "../../upstash/scan.js";

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

async function upsertSnapshot({ snapshot, tenantId }) {
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

async function upsertMetric({ snapshot, tenantId }) {
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
      snapshot.place_id,
      snapshot.captured_date,
      snapshot.rating ?? null,
      snapshot.review_count ?? 0,
      snapshot.primary_type || null,
    ]
  );
}

function extractSnapshotIndexDate(key, tenantId) {
  const pattern = new RegExp(`^gmb:${tenantId}:index:(\\d{4}-\\d{2}-\\d{2}):snapshot_keys$`);
  return key.match(pattern)?.[1] || null;
}

async function discoverSnapshotDates({ tenantId, limitDates }) {
  const pattern = `gmb:${tenantId}:index:*:snapshot_keys`;
  const scan = await scanAllKeys({ pattern, count: 1000, maxKeys: limitDates });
  const dates = Array.from(
    new Set(scan.keys.map((key) => extractSnapshotIndexDate(key, tenantId)).filter(Boolean))
  ).sort();

  return {
    pattern,
    indexes_found: scan.keys.length,
    dates,
    scan_complete: scan.complete,
    scan_cursor: scan.cursor,
    scan_iterations: scan.iterations,
  };
}

async function migrateSnapshotDate({ tenantId, date, offset, limit, dryRun }) {
  const indexKey = `gmb:${tenantId}:index:${date}:snapshot_keys`;
  const rawKeys = await redis(["GET", indexKey]);
  const keys = parseRedisJson(rawKeys, "snapshot_keys");

  if (!Array.isArray(keys)) throw new Error("snapshot_keys_not_array");

  const batch = keys.slice(offset, offset + limit);
  const result = {
    date,
    index_key: indexKey,
    offset,
    limit,
    total_keys: keys.length,
    scanned: batch.length,
    inserted_or_updated: 0,
    skipped_other_tenant: 0,
    skipped_unknown_place: 0,
    failed: 0,
    next_offset: offset + batch.length,
    done: offset + batch.length >= keys.length,
    errors: [],
  };

  const tenantCache = new Map();

  for (const key of batch) {
    try {
      if (typeof key !== "string" || !key.startsWith(`gmb:snapshot:${date}:`)) {
        throw new Error("snapshot_key_not_allowed");
      }

      const raw = await redis(["GET", key]);
      const snapshot = parseRedisJson(raw, "snapshot");

      if (!snapshot.place_id || !snapshot.captured_date) {
        throw new Error("invalid_snapshot_shape");
      }

      let resolvedTenantId = tenantCache.get(snapshot.place_id);
      if (resolvedTenantId === undefined) {
        resolvedTenantId = await resolveTenantId(snapshot.place_id);
        tenantCache.set(snapshot.place_id, resolvedTenantId);
      }

      if (!resolvedTenantId) {
        result.skipped_unknown_place += 1;
        continue;
      }

      if (resolvedTenantId !== tenantId) {
        result.skipped_other_tenant += 1;
        continue;
      }

      if (!dryRun) {
        await upsertSnapshot({ snapshot, tenantId });
        await upsertMetric({ snapshot, tenantId });
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

export async function migrateSnapshots({ tenantId, date, offsetPerDate, limitPerDate, limitDates, dryRun }) {
  const discovery = date
    ? {
        pattern: `gmb:${tenantId}:index:${date}:snapshot_keys`,
        indexes_found: 1,
        dates: [date],
        scan_complete: true,
        scan_cursor: "0",
        scan_iterations: 0,
      }
    : await discoverSnapshotDates({ tenantId, limitDates });

  const dates = discovery.dates.slice(0, limitDates);
  const summaries = [];

  for (const currentDate of dates) {
    summaries.push(
      await migrateSnapshotDate({
        tenantId,
        date: currentDate,
        offset: offsetPerDate,
        limit: limitPerDate,
        dryRun,
      })
    );
  }

  return {
    tenant_id: tenantId,
    date,
    dry_run: dryRun,
    offset_per_date: offsetPerDate,
    limit_per_date: limitPerDate,
    limit_dates: limitDates,
    discovery,
    summaries,
    total_scanned: summaries.reduce((sum, item) => sum + item.scanned, 0),
    total_inserted_or_updated: summaries.reduce((sum, item) => sum + item.inserted_or_updated, 0),
    total_failed: summaries.reduce((sum, item) => sum + item.failed, 0),
    done: summaries.every((item) => item.done) && discovery.scan_complete,
  };
}
