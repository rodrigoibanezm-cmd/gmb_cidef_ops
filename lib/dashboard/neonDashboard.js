import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export const ALLOWED_TENANTS = ['sodimac', 'cidef', 'beauty_plus'];

export async function getDashboardFromNeon(tenant_id, view = 'full') {
  const rows = await sql`
    SELECT payload
    FROM dashboard_snapshots
    WHERE tenant_id = ${tenant_id}
      AND view = ${view}
    ORDER BY snapshot_date DESC
    LIMIT 1
  `;

  return rows[0]?.payload || null;
}
