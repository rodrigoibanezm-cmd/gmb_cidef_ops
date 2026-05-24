import { redisCommand } from "../../../lib/gmb/redis.js";
import { gmbCaptureKeys } from "../../../lib/gmb/keys.js";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function requireTenantId(req) {
  const tenantId = req.query.tenant_id || req.query.tenant;
  return typeof tenantId === "string" && tenantId.trim() ? tenantId.trim() : null;
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

export default async function handler(req, res) {
  const tenantId = requireTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ ok: false, error: "tenant_id_required" });
  }

  try {
    const date = req.query.date || today();

    const snapshotKeys = await scanKeys(gmbCaptureKeys.snapshot(date, "*", tenantId));
    const indexedPlaceIds = safeJson(await redisCommand(["GET", gmbCaptureKeys.index(date, "place_ids", tenantId)])) || [];

    const snapshotPlaceIds = snapshotKeys.map((key) => snapshotPlaceId(date, key, tenantId));
    const indexedSet = new Set(indexedPlaceIds);

    const missing_in_index = snapshotPlaceIds.filter((placeId) => !indexedSet.has(placeId));

    return res.status(200).json({
      ok: true,
      tenant_id: tenantId,
      date,
      snapshots: snapshotPlaceIds.length,
      indexed_places: indexedPlaceIds.length,
      missing_in_index_count: missing_in_index.length,
      missing_in_index: missing_in_index.slice(0, 20),
      updated: missing_in_index.length === 0,
    });
  } catch (error) {
    console.error("index status failed", error);
    return res.status(500).json({ ok: false, error: "index_status_failed" });
  }
}
