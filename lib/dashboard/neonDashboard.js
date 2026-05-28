import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export const ALLOWED_TENANTS = ['sodimac', 'cidef', 'beauty_plus'];
export const ALLOWED_VIEWS = ['full', 'operational', 'competitive'];

const SECTION_ORDER = ['urgente', 'tareas', 'importante'];
const COMPETITIVE_SECTION_ORDER = ['erosion', 'momentum_rival', 'atributo_disputa', 'presion_emergente'];
const MAX_OPERATIONAL_CARDS = 12;
const MAX_COMPETITIVE_CARDS = 5;

function emptySections(sectionOrder) {
  return sectionOrder.map(id => ({ id, cards: [] }));
}

function groupSections(cards, sectionOrder) {
  const sections = emptySections(sectionOrder);
  const byId = new Map(sections.map(section => [section.id, section]));

  for (const card of cards) {
    const section = byId.get(card.section);
    if (section) section.cards.push(card);
  }

  return sections;
}

function emptyOperationalSections() {
  return emptySections(SECTION_ORDER);
}

function groupOperationalSections(cards) {
  return groupSections(cards, SECTION_ORDER);
}

function shapeOperationalCard(row) {
  return {
    id: row.id,
    section: row.section,
    type: row.type,
    scope: row.scope,
    status: row.status,
    color_key: row.color_key,
    icon_key: row.icon_key,
    headline: row.headline,
    why_it_matters: row.why_it_matters,
    suggested_action: row.suggested_action,
    evidence: row.evidence_json || [],
    children: row.children_json || [],
    priority_order: row.priority_order,
    agent_context: row.agent_context || {}
  };
}

function shapePressureCard(row) {
  return {
    id: row.id,
    section: row.section,
    type: row.agent_context?.pressure_type || row.section,
    scope: 'competitive',
    status: row.agent_context?.pressure_type || row.section,
    color_key: row.color_key,
    icon_key: null,
    headline: row.headline,
    why_it_matters: row.why_it_matters,
    risk: row.risk,
    suggested_action: row.suggested_action,
    evidence: row.evidence || [],
    children: [],
    priority_order: row.card_order,
    agent_context: row.agent_context || {}
  };
}

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
      COALESCE(r.review_date, c.classified_at) AS alert_date
    FROM review_classifications c
    LEFT JOIN places p
      ON p.tenant_id = c.tenant_id
     AND p.place_id = c.place_id
    LEFT JOIN place_reviews r
      ON r.tenant_id = c.tenant_id
     AND r.place_id = c.place_id
     AND r.review_hash = c.review_hash
    WHERE c.tenant_id = ${tenant_id}
      AND c.requires_alert = true
    ORDER BY
      CASE c.severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END,
      COALESCE(r.review_date, c.classified_at) DESC
    LIMIT 20
  `;

  return {
    critical_count: rows.filter(r => r.severity === 'critical').length,
    high_count: rows.filter(r => r.severity === 'high').length,
    total_alerts: rows.length,
    top_alerts: rows
  };
}

export async function getOperationalDashboardFromNeon(tenant_id) {
  const rows = await sql`
    SELECT
      id,
      tenant_id,
      card_date,
      section,
      type,
      scope,
      status,
      color_key,
      icon_key,
      headline,
      why_it_matters,
      suggested_action,
      evidence_json,
      children_json,
      agent_context,
      priority_order
    FROM operational_cards
    WHERE tenant_id = ${tenant_id}
      AND card_date = (
        SELECT max(card_date)
        FROM operational_cards
        WHERE tenant_id = ${tenant_id}
      )
    ORDER BY priority_order ASC
    LIMIT ${MAX_OPERATIONAL_CARDS}
  `;

  const cards = rows.map(shapeOperationalCard);
  const cardDate = rows[0]?.card_date || null;

  return {
    ok: true,
    tenant_id,
    view: 'operational',
    date: cardDate,
    max_cards: MAX_OPERATIONAL_CARDS,
    card_count: cards.length,
    sections: groupOperationalSections(cards)
  };
}

export async function getCompetitiveDashboardFromNeon(tenant_id) {
  const rows = await sql`
    SELECT
      id,
      tenant_id,
      view,
      snapshot_date,
      section,
      card_order,
      color_key,
      headline,
      why_it_matters,
      risk,
      suggested_action,
      evidence,
      agent_context
    FROM dashboard_pressure_cards
    WHERE tenant_id = ${tenant_id}
      AND view = 'competitive'
      AND is_active = true
      AND snapshot_date = (
        SELECT max(snapshot_date)
        FROM dashboard_pressure_cards
        WHERE tenant_id = ${tenant_id}
          AND view = 'competitive'
          AND is_active = true
      )
    ORDER BY card_order ASC
    LIMIT ${MAX_COMPETITIVE_CARDS}
  `;

  const cards = rows.map(shapePressureCard);
  const snapshotDate = rows[0]?.snapshot_date || null;

  return {
    ok: true,
    tenant_id,
    view: 'competitive',
    date: snapshotDate,
    max_cards: MAX_COMPETITIVE_CARDS,
    card_count: cards.length,
    sections: groupSections(cards, COMPETITIVE_SECTION_ORDER)
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
