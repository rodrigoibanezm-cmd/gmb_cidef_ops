import {
  ALLOWED_TENANTS,
  ALLOWED_VIEWS,
  getDashboardFromNeon,
  getOperationalDashboardFromNeon
} from '../lib/dashboard/neonDashboard.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      error: 'method_not_allowed'
    });
  }

  const tenant_id = String(req.query.tenant_id || '').trim();
  const view = String(req.query.view || 'full').trim();

  if (!tenant_id) {
    return res.status(400).json({
      ok: false,
      error: 'missing_tenant_id'
    });
  }

  if (!ALLOWED_TENANTS.includes(tenant_id)) {
    return res.status(400).json({
      ok: false,
      error: 'invalid_tenant_id',
      allowed_tenants: ALLOWED_TENANTS
    });
  }

  if (!ALLOWED_VIEWS.includes(view)) {
    return res.status(400).json({
      ok: false,
      error: 'invalid_view',
      allowed_views: ALLOWED_VIEWS
    });
  }

  try {
    if (view === 'operational') {
      const payload = await getOperationalDashboardFromNeon(tenant_id);

      return res.status(200).json(payload);
    }

    const payload = await getDashboardFromNeon(tenant_id, view);

    if (!payload) {
      return res.status(404).json({
        ok: false,
        error: 'dashboard_snapshot_not_found',
        tenant_id,
        view
      });
    }

    return res.status(200).json({
      ...payload,
      view
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'dashboard_runtime_error',
      message: error.message
    });
  }
}
