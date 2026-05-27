import { dbQuery } from '../gmb/postgres.js';

const TENANT_CONFIG = {
  sodimac: {
    tenantName: 'Sodimac',
    competitorDimension: 'brand',
    minOwnReviews: 1,
    minCompetitorReviews: 1,
    unitText: 'zonas',
    headlineVerb: 'pierde liderazgo local en',
    leaderSuffix: 'de ellas',
    noRiskText: 'no presenta zonas con pérdida competitiva local.'
  },
  beauty_plus: {
    tenantName: 'Beauty Plus',
    competitorDimension: 'brand',
    minOwnReviews: 1,
    minCompetitorReviews: 1,
    unitText: 'zonas',
    headlineVerb: 'pierde liderazgo local en',
    leaderSuffix: 'de ellas',
    noRiskText: 'no presenta zonas con pérdida competitiva local.'
  },
  cidef: {
    tenantName: 'CIDEF',
    competitorDimension: 'operator',
    minOwnReviews: 20,
    minCompetitorReviews: 20,
    unitText: 'puntos de la red',
    headlineVerb: 'pierde frente a competidores en',
    leaderSuffix: 'de ellos',
    noRiskText: 'no presenta puntos con pérdida competitiva local confiable.'
  }
};

export const DASHBOARD_TENANTS = Object.keys(TENANT_CONFIG);

export function getDashboardTenantConfig(tenantId) {
  return TENANT_CONFIG[tenantId] || null;
}

async function ensureDashboardSnapshotsTable() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS dashboard_snapshots (
      id BIGSERIAL PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      snapshot_date DATE NOT NULL,
      view TEXT NOT NULL DEFAULT 'full',
      payload JSONB NOT NULL,
      source TEXT NOT NULL DEFAULT 'neon_materialized',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, snapshot_date, view)
    )
  `);

  await dbQuery(`
    CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_latest
    ON dashboard_snapshots (tenant_id, view, snapshot_date DESC)
  `);
}

export async function rebuildDashboardSnapshot({ tenantId, date = null }) {
  const config = getDashboardTenantConfig(tenantId);

  if (!config) {
    const error = new Error('invalid_tenant_id');
    error.code = 'invalid_tenant_id';
    error.allowedTenants = DASHBOARD_TENANTS;
    throw error;
  }

  await ensureDashboardSnapshotsTable();

  const rows = await dbQuery(
    `
    WITH params AS (
      SELECT
        $1::text AS tenant_id,
        $2::text AS tenant_name,
        COALESCE($3::date, MAX(captured_date)::date) AS snapshot_date
      FROM place_daily_metrics
      WHERE tenant_id = $1
    ),
    base AS (
      SELECT
        m.tenant_id,
        m.place_id,
        m.captured_date,
        m.rating,
        m.review_count,
        p.name,
        p.brand,
        p.operator,
        p.store_role,
        p.normalized_location,
        p.ownership_group
      FROM place_daily_metrics m
      JOIN places p
        ON p.tenant_id = m.tenant_id
       AND p.place_id = m.place_id
      JOIN params x
        ON x.tenant_id = m.tenant_id
       AND x.snapshot_date = m.captured_date
      WHERE m.rating IS NOT NULL
        AND m.review_count > 0
    ),
    own_base AS (
      SELECT *
      FROM base
      WHERE ownership_group = 'own'
    ),
    own_confident AS (
      SELECT *
      FROM own_base
      WHERE review_count >= $4
    ),
    competitor_leaders AS (
      SELECT DISTINCT ON (normalized_location)
        normalized_location,
        name AS leader_name,
        brand AS leader_brand,
        operator AS leader_operator,
        rating AS leader_rating,
        review_count AS leader_review_count
      FROM base
      WHERE ownership_group = 'competitor'
        AND review_count >= $5
        AND ($6 <> 'operator' OR (operator IS NOT NULL AND operator <> 'unknown'))
      ORDER BY normalized_location, rating DESC, review_count DESC
    ),
    red_flags AS (
      SELECT jsonb_agg(to_jsonb(x)) AS data
      FROM (
        SELECT
          ROW_NUMBER() OVER (ORDER BY rating ASC, review_count DESC) AS rank,
          place_id,
          name,
          brand,
          operator,
          store_role,
          normalized_location AS location,
          rating,
          0 AS delta,
          review_count,
          CASE WHEN rating < 3.8 THEN 'high' ELSE 'medium' END AS severity,
          'Bajo umbral reputacional' AS reason
        FROM own_confident
        WHERE rating < 4.0
        ORDER BY rating ASC, review_count DESC
        LIMIT 10
      ) x
    ),
    bottom AS (
      SELECT jsonb_agg(to_jsonb(x)) AS data
      FROM (
        SELECT
          ROW_NUMBER() OVER (ORDER BY rating ASC, review_count DESC) AS rank,
          place_id,
          name,
          brand,
          operator,
          store_role,
          normalized_location AS location,
          rating,
          0 AS delta,
          review_count,
          'medium' AS severity,
          'Bajo desempeño reputacional relativo' AS reason
        FROM own_confident
        ORDER BY rating ASC, review_count DESC
        LIMIT 5
      ) x
    ),
    top AS (
      SELECT jsonb_agg(to_jsonb(x)) AS data
      FROM (
        SELECT
          ROW_NUMBER() OVER (ORDER BY rating DESC, review_count DESC) AS rank,
          place_id,
          name,
          brand,
          operator,
          store_role,
          normalized_location AS location,
          rating,
          0 AS delta,
          review_count,
          'low' AS severity,
          'Mejor desempeño reputacional' AS reason
        FROM own_confident
        ORDER BY rating DESC, review_count DESC
        LIMIT 5
      ) x
    ),
    own_risk AS (
      SELECT
        o.place_id AS own_place_id,
        o.name AS own_name,
        o.brand,
        o.operator,
        o.store_role,
        o.normalized_location AS location,
        o.rating AS own_rating,
        o.review_count AS own_review_count,
        c.leader_name,
        c.leader_brand,
        c.leader_operator,
        c.leader_rating,
        c.leader_review_count,
        ROUND((o.rating - c.leader_rating)::numeric, 2) AS gap_vs_leader,
        'Pierde contra el líder competitivo local por ' ||
          ABS(ROUND((o.rating - c.leader_rating)::numeric, 2)) ||
          ' puntos' AS reason
      FROM own_confident o
      JOIN competitor_leaders c
        ON c.normalized_location = o.normalized_location
      WHERE o.rating < c.leader_rating
      ORDER BY gap_vs_leader ASC, o.review_count DESC
      LIMIT 10
    ),
    own_risk_ranked AS (
      SELECT
        ROW_NUMBER() OVER (ORDER BY gap_vs_leader ASC, own_review_count DESC) AS local_rank,
        COUNT(*) OVER () AS local_total,
        *
      FROM own_risk
    ),
    local_competitive_risk AS (
      SELECT COALESCE(jsonb_agg(to_jsonb(own_risk_ranked)), '[]'::jsonb) AS data
      FROM own_risk_ranked
    ),
    dominant_competitor AS (
      SELECT
        CASE WHEN $6 = 'operator' THEN leader_operator ELSE leader_brand END AS competitor,
        COUNT(*)::int AS cnt
      FROM own_risk
      WHERE CASE WHEN $6 = 'operator' THEN leader_operator ELSE leader_brand END IS NOT NULL
        AND CASE WHEN $6 = 'operator' THEN leader_operator ELSE leader_brand END <> 'unknown'
      GROUP BY competitor
      ORDER BY cnt DESC, competitor ASC
      LIMIT 1
    ),
    competitive_summary AS (
      SELECT
        COUNT(*)::int AS risk_count,
        COALESCE((SELECT competitor FROM dominant_competitor), 'sin_competidor') AS dominant_competitor,
        COALESCE((SELECT cnt FROM dominant_competitor), 0) AS dominant_competitor_count
      FROM own_risk
    ),
    k AS (
      SELECT
        ROUND(AVG(rating)::numeric, 2) AS average_rating,
        COALESCE(SUM(review_count), 0)::int AS total_reviews,
        COUNT(*) FILTER (WHERE rating < 4.0)::int AS critical_stores
      FROM own_confident
    )
    INSERT INTO dashboard_snapshots (
      tenant_id,
      snapshot_date,
      view,
      payload,
      source,
      updated_at
    )
    SELECT
      x.tenant_id,
      x.snapshot_date,
      'full',
      jsonb_build_object(
        'ok', true,
        'source', 'neon_materialized',
        'tenant_id', x.tenant_id,
        'tenant_name', x.tenant_name,
        'updated_at', NOW(),
        'period', jsonb_build_object(
          'current_date', x.snapshot_date,
          'comparison_label', 'vs. período anterior'
        ),
        'kpis', jsonb_build_object(
          'average_rating', k.average_rating,
          'rating_delta', 0,
          'total_reviews', k.total_reviews,
          'reviews_delta', 0,
          'critical_stores', k.critical_stores,
          'worst_drop', (SELECT data->0 FROM bottom),
          'best_store', (SELECT data->0 FROM top)
        ),
        'executive_summary', jsonb_build_object(
          'facts', jsonb_build_array(
            'rating=' || ROUND(k.average_rating::numeric, 2),
            'rating_delta=0',
            'critical_stores=' || k.critical_stores::text,
            'confidence_threshold=' || $4::text || '_reviews'
          ),
          'desktop_hint',
            'La red propia mantiene una nota promedio de ' ||
            ROUND(k.average_rating::numeric, 2) ||
            ', con ' ||
            k.critical_stores::text ||
            CASE WHEN $7 LIKE 'puntos%' THEN ' puntos bajo el umbral reputacional.' ELSE ' tiendas bajo el umbral reputacional.' END,
          'mobile_hint',
            k.critical_stores::text ||
            CASE WHEN $7 LIKE 'puntos%' THEN ' puntos de la red requieren atención reputacional.' ELSE ' tiendas propias requieren atención reputacional.' END
        ),
        'competitive_summary', jsonb_build_object(
          'risk_count', cs.risk_count,
          'dominant_competitor', cs.dominant_competitor,
          'dominant_competitor_count', cs.dominant_competitor_count,
          'headline',
            CASE
              WHEN cs.risk_count = 0 THEN x.tenant_name || ' ' || $10
              ELSE
                x.tenant_name ||
                ' ' || $8 || ' ' ||
                cs.risk_count::text ||
                ' ' || $7 || '. ' ||
                INITCAP(REPLACE(cs.dominant_competitor, '_', ' ')) ||
                ' lidera en ' ||
                cs.dominant_competitor_count::text ||
                ' ' || $9 || '.'
            END
        ),
        'mobile_priority', jsonb_build_object(
          'headline',
            cs.risk_count::text ||
            ' ' || $7 || ' con riesgo competitivo local.',
          'critical_count', k.critical_stores,
          'accelerating_count', 0,
          'immediate_action_count', LEAST(2, cs.risk_count)
        ),
        'local_competitive_risk', (SELECT data FROM local_competitive_risk),
        'red_flags', COALESCE((SELECT data FROM red_flags), '[]'::jsonb),
        'movements', jsonb_build_object(
          'up', '[]'::jsonb,
          'down', '[]'::jsonb
        ),
        'rankings', jsonb_build_object(
          'top', COALESCE((SELECT data FROM top), '[]'::jsonb),
          'bottom', COALESCE((SELECT data FROM bottom), '[]'::jsonb)
        )
      ),
      'neon_materialized',
      NOW()
    FROM params x
    CROSS JOIN k
    CROSS JOIN competitive_summary cs
    WHERE x.snapshot_date IS NOT NULL
    ON CONFLICT (tenant_id, snapshot_date, view)
    DO UPDATE SET
      payload = EXCLUDED.payload,
      source = EXCLUDED.source,
      updated_at = NOW()
    RETURNING
      tenant_id,
      snapshot_date,
      view,
      source,
      payload->'competitive_summary' AS competitive_summary,
      payload->'kpis' AS kpis
    `,
    [
      tenantId,
      config.tenantName,
      date,
      config.minOwnReviews,
      config.minCompetitorReviews,
      config.competitorDimension,
      config.unitText,
      config.headlineVerb,
      config.leaderSuffix,
      config.noRiskText
    ]
  );

  if (!rows[0]) {
    const error = new Error('dashboard_snapshot_not_materialized');
    error.code = 'dashboard_snapshot_not_materialized';
    throw error;
  }

  return rows[0];
}
