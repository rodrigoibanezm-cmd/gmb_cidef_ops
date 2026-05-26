import { ALLOWED_TENANTS, getMockDashboard } from '../lib/dashboard/mockDashboard.js';

export default async function handler(req, res) {
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

  const allowedViews = ['full'];

  if (!allowedViews.includes(view)) {
    return res.status(400).json({
      ok: false,
      error: 'invalid_view',
      allowed_views: allowedViews
    });
  }

  const payload = getMockDashboard(tenant_id);

  return res.status(200).json({
    ...payload,
    view
  });
}
