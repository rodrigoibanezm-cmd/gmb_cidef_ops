import { DASHBOARD_TENANTS, rebuildDashboardSnapshot } from '../../lib/dashboard/materialize.js';

function requireTenantId(req) {
  const tenantId = req.query.tenant_id || req.query.tenant;
  return typeof tenantId === 'string' && tenantId.trim() ? tenantId.trim() : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'method_not_allowed'
    });
  }

  if (req.query.confirm !== 'true') {
    return res.status(400).json({
      ok: false,
      error: 'confirm_required'
    });
  }

  const tenantId = requireTenantId(req);

  if (!tenantId) {
    return res.status(400).json({
      ok: false,
      error: 'tenant_id_required'
    });
  }

  if (!DASHBOARD_TENANTS.includes(tenantId)) {
    return res.status(400).json({
      ok: false,
      error: 'invalid_tenant_id',
      allowed_tenants: DASHBOARD_TENANTS
    });
  }

  const date = req.query.date || null;

  try {
    const snapshot = await rebuildDashboardSnapshot({ tenantId, date });

    return res.status(200).json({
      ok: true,
      tenant_id: snapshot.tenant_id,
      snapshot_date: snapshot.snapshot_date,
      view: snapshot.view,
      source: snapshot.source,
      competitive_summary: snapshot.competitive_summary,
      kpis: snapshot.kpis
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.code || 'dashboard_rebuild_failed',
      message: error.message,
      tenant_id: tenantId,
      allowed_tenants: error.allowedTenants || undefined
    });
  }
}
