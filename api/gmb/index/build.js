import { buildGmbIndexes } from "../../../lib/gmb/indexBuilder.js";

function requireTenantId(req) {
  const tenantId = req.query.tenant_id || req.query.tenant;
  return typeof tenantId === "string" && tenantId.trim() ? tenantId.trim() : null;
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
    const date = req.query.date || undefined;

    const result = await buildGmbIndexes({ date, tenantId });

    return res.status(200).json({
      ok: true,
      tenant_id: tenantId,
      index: result,
    });
  } catch (error) {
    console.error("build gmb indexes failed", error);
    return res.status(500).json({ ok: false, error: "build_indexes_failed" });
  }
}
