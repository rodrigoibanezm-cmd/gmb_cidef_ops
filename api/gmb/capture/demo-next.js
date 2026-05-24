import { capturePlacesDemo } from "../../../lib/gmb/capturePlacesDemo.js";
import { buildGmbIndexes } from "../../../lib/gmb/indexBuilder.js";
import { gmbCaptureKeys } from "../../../lib/gmb/keys.js";
import { redisCommand } from "../../../lib/gmb/redis.js";

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function requireTenantId(req) {
  const tenantId = req.query.tenant_id || req.query.tenant;
  return typeof tenantId === "string" && tenantId.trim() ? tenantId.trim() : null;
}

async function readRun(date, tenantId) {
  const raw = await redisCommand(["GET", gmbCaptureKeys.run(date, tenantId)]);
  return raw ? JSON.parse(raw) : null;
}

async function saveRun(date, tenantId, run) {
  await redisCommand(["SET", gmbCaptureKeys.run(date, tenantId), JSON.stringify(run)]);
}

function buildNextRun(previousRun, result, limit) {
  return {
    tenant_id: result.tenant_id,
    captured_date: result.captured_date,
    total: result.total,
    existing: result.existing,
    missing: result.missing,
    limit,
    saved: Number(previousRun?.saved || 0) + result.saved,
    failed: Number(previousRun?.failed || 0) + result.failed,
    done: result.done,
    indexes_built: false,
    updated_at: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const tenantId = requireTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ ok: false, error: "tenant_id_required" });
  }

  try {
    const date = today();
    const limit = parseNumber(req.query.limit, 25);
    const run = await readRun(date, tenantId);
    const result = await capturePlacesDemo({ limit, offset: 0, tenantId });
    const nextRun = buildNextRun(run, result, limit);
    const shouldBuildIndex = result.done || req.query.rebuild_index === "true";
    const index = shouldBuildIndex ? await buildGmbIndexes({ date: result.captured_date, tenantId }) : null;

    nextRun.indexes_built = Boolean(index);
    await saveRun(date, tenantId, nextRun);

    return res.status(200).json({ ok: true, tenant_id: tenantId, result, run: nextRun, index });
  } catch (error) {
    console.error("capture demo-next failed", error);
    return res.status(500).json({ ok: false, error: "capture_demo_next_failed", message: error.message });
  }
}
