import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export const ALLOWED_TENANTS = ['sodimac', 'cidef', 'beauty_plus'];

async function getQualitativeAlerts(tenant_id) {
  const rows = await sql`
    SELECT
      c.tenant_id,
      c.place_id,
      p.name AS store_name,
      p.normalized_location AS location,
      c.review_hash,
      c.severity,
      c.risk_type,
      c.requires_alert,
      c.needs_human_review,
      c.safe_label,
      c.summary,
      c.evidence_excerpt,
      c.classified_at,
      c.classified_at AS alert_date
    FROM review_classifications c
    LEFT JOIN places p
      ON p.tenant_id = c.tenant_id
     AND p.place_id = c.place_id
    WHERE c.tenant_id = ${tenant_id}
      AND c.requires_alert = true
    ORDER BY
      CASE c.severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END,
      c.classified_at DESC
    LIMIT 20
  `;

  return {
    critical_count: rows.filter(r => r.severity === 'critical').length,
    high_count: rows.filter(r => r.severity === 'high').length,
    total_alerts: rows.length,
    top_alerts: rows
  };
}

export async function getDashboardFromNeon(tenant_id, view = 'full') {
  const rows = await sql`
    SELECT payload
    FROM dashboard_snapshots
    WHERE tenant_id = ${tenant_id}
      AND view = ${view}
    ORDER BY snapshot_date DESC
    LIMIT 1
  `;

  const payload = rows[0]?.payload || null;
  if (!payload) return null;

  return {
    ...payload,
    qualitative_alerts: await getQualitativeAlerts(tenant_id)
  };
}
