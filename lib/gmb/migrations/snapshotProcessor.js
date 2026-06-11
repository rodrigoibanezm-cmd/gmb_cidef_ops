import { redis, parseRedisJson } from "../../upstash/client.js";
import {
  resolveTenantId,
  upsertMetric,
  upsertSnapshot,
} from "./snapshotPersistence.js";

function createDateResult({ date, indexKey, offset, limit, totalKeys, batchLength }) {
  return {
    date,
    index_key: indexKey,
    offset,
    limit,
    total_keys: totalKeys,
    scanned: batchLength,
    inserted_or_updated: 0,
    skipped_other_tenant: 0,
    skipped_unknown_place: 0,
    failed: 0,
    next_offset: offset + batchLength,
    done: offset + batchLength >= totalKeys,
    errors: [],
  };
}

async function resolveSnapshotTenant({ snapshot, tenantCache }) {
  if (tenantCache.has(snapshot.place_id)) return tenantCache.get(snapshot.place_id);

  const tenantId = await resolveTenantId(snapshot.place_id);
  tenantCache.set(snapshot.place_id, tenantId);
  return tenantId;
}

function isAllowedSnapshotKey({ key, tenantId, date }) {
  if (typeof key !== "string") return false;

  return (
    key.startsWith(`gmb:snapshot:${date}:`) ||
    key.startsWith(`gmb:${tenantId}:snapshot:${date}:`)
  );
}

async function processSnapshotKey({ key, tenantId, date, dryRun, tenantCache, result }) {
  if (!isAllowedSnapshotKey({ key, tenantId, date })) {
    throw new Error("snapshot_key_not_allowed");
  }

  const raw = await redis(["GET", key]);
  const snapshot = parseRedisJson(raw, "snapshot");

  if (!snapshot.place_id || !snapshot.captured_date) {
    throw new Error("invalid_snapshot_shape");
  }

  const resolvedTenantId = await resolveSnapshotTenant({ snapshot, tenantCache });

  if (!resolvedTenantId) {
    result.skipped_unknown_place += 1;
    return;
  }

  if (resolvedTenantId !== tenantId) {
    result.skipped_other_tenant += 1;
    return;
  }

  if (!dryRun) {
    await upsertSnapshot({ snapshot, tenantId });
    await upsertMetric({ snapshot, tenantId });
  }

  result.inserted_or_updated += 1;
}

export async function migrateSnapshotDate({ tenantId, date, offset, limit, dryRun }) {
  const indexKey = `gmb:${tenantId}:index:${date}:snapshot_keys`;
  const rawKeys = await redis(["GET", indexKey]);
  const keys = parseRedisJson(rawKeys, "snapshot_keys");

  if (!Array.isArray(keys)) throw new Error("snapshot_keys_not_array");

  const batch = keys.slice(offset, offset + limit);
  const tenantCache = new Map();
  const result = createDateResult({
    date,
    indexKey,
    offset,
    limit,
    totalKeys: keys.length,
    batchLength: batch.length,
  });

  for (const key of batch) {
    try {
      await processSnapshotKey({ key, tenantId, date, dryRun, tenantCache, result });
    } catch (error) {
      result.failed += 1;
      if (result.errors.length < 20) {
        result.errors.push({ key, error: error.message });
      }
    }
  }

  return result;
}
