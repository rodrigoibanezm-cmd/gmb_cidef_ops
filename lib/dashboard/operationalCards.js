import { dbQuery } from '../gmb/postgres.js';

const MAX_CARDS = 12;

function todayChile() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function sectionForSeverity(severity) {
  if (severity === 'critical' || severity === 'high') return 'urgente';
  if (severity === 'medium') return 'tareas';
  return 'importante';
}

function colorForSeverity(severity) {
  if (severity === 'critical') return 'red';
  if (severity === 'high') return 'orange';
  if (severity === 'medium') return 'yellow';
  return 'blue';
}

function statusForSeverity(severity) {
  if (severity === 'critical' || severity === 'high') return 'nuevo';
  if (severity === 'medium') return 'monitorear';
  return 'monitorear';
}

function typeForRisk(riskType) {
  if (riskType === 'legal' || riskType === 'legal_reputacional' || riskType === 'fraude_acusacion' || riskType === 'seguridad') return 'incidente';
  if (riskType === 'reputacional' || riskType === 'operacional') return 'patron';
  return 'oportunidad';
}

function iconForRisk(riskType) {
  if (riskType === 'legal' || riskType === 'legal_reputacional' || riskType === 'fraude_acusacion') return 'legal';
  if (riskType === 'seguridad') return 'incident';
  if (riskType === 'reputacional') return 'pattern';
  if (riskType === 'operacional') return 'operations';
  return 'opportunity';
}

function safeText(value, fallback) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  return clean || fallback;
}

function shapeCard(row, priorityOrder) {
  const severity = row.severity || 'low';
  const riskType = row.risk_type || 'none';
  const storeName = safeText(row.store_name, 'Tienda Beauty Plus');
  const location = safeText(row.location, 'ubicación no informada');
  const label = safeText(row.safe_label, 'Señal cualitativa detectada');
  const summary = safeText(row.summary, 'Review clasificada por el agente.');
  const evidence = safeText(row.evidence_excerpt, 'Sin extracto disponible.');

  return {
    tenant_id: row.tenant_id,
    card_date: row.card_date,
    section: sectionForSeverity(severity),
    type: typeForRisk(riskType),
    scope: 'tienda',
    status: statusForSeverity(severity),
    color_key: colorForSeverity(severity),
    icon_key: iconForRisk(riskType),
    headline: `${label} · ${storeName}`.slice(0, 180),
    why_it_matters: summary.slice(0, 260),
    suggested_action: row.needs_human_review
      ? 'Revisar el caso con responsable de tienda y documentar respuesta.'
      : 'Monitorear la señal y revisar si se repite en nuevas reviews.',
    evidence_json: [evidence, `Tienda: ${storeName}`, `Ubicación: ${location}`],
    children_json: [],
    agent_context: {
      source: 'review_classifications',
      place_id: row.place_id,
      review_hash: row.review_hash,
      severity,
      risk_type: riskType,
      requires_alert: row.requires_alert,
      needs_human_review: row.needs_human_review,
      classified_at: row.classified_at,
    },
    priority_order: priorityOrder,
  };
}

async function readAlertRows({ tenantId, date }) {
  return dbQuery(
    `select
       c.tenant_id,
       $2::date as card_date,
       c.place_id,
       p.name as store_name,
       p.normalized_location as location,
       c.review_hash,
       c.severity,
       c.risk_type,
       c.requires_alert,
       c.needs_human_review,
       c.safe_label,
       c.summary,
       c.evidence_excerpt,
       c.classified_at,
       coalesce(r.review_date, c.classified_at) as signal_date
     from review_classifications c
     left join places p
       on p.tenant_id = c.tenant_id
      and p.place_id = c.place_id
     left join place_reviews r
       on r.tenant_id = c.tenant_id
      and r.place_id = c.place_id
      and r.review_hash = c.review_hash
     where c.tenant_id = $1
       and c.classification_version = 'v1'
       and c.requires_alert = true
     order by
       case c.severity
         when 'critical' then 1
         when 'high' then 2
         when 'medium' then 3
         else 4
       end,
       coalesce(r.review_date, c.classified_at) desc
     limit $3`,
    [tenantId, date, MAX_CARDS]
  );
}

async function writeCards({ tenantId, date, cards }) {
  await dbQuery(
    `delete from operational_cards
     where tenant_id = $1
       and card_date = $2`,
    [tenantId, date]
  );

  for (const card of cards) {
    await dbQuery(
      `insert into operational_cards (
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
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      on conflict (tenant_id, card_date, priority_order)
      do update set
        section = excluded.section,
        type = excluded.type,
        scope = excluded.scope,
        status = excluded.status,
        color_key = excluded.color_key,
        icon_key = excluded.icon_key,
        headline = excluded.headline,
        why_it_matters = excluded.why_it_matters,
        suggested_action = excluded.suggested_action,
        evidence_json = excluded.evidence_json,
        children_json = excluded.children_json,
        agent_context = excluded.agent_context,
        updated_at = now()`,
      [
        card.tenant_id,
        card.card_date,
        card.section,
        card.type,
        card.scope,
        card.status,
        card.color_key,
        card.icon_key,
        card.headline,
        card.why_it_matters,
        card.suggested_action,
        JSON.stringify(card.evidence_json),
        JSON.stringify(card.children_json),
        JSON.stringify(card.agent_context),
        card.priority_order,
      ]
    );
  }
}

export async function rebuildOperationalCards({ tenantId, date = null }) {
  const cardDate = date || todayChile();
  const rows = await readAlertRows({ tenantId, date: cardDate });
  const cards = rows.map((row, index) => shapeCard(row, index + 1));

  await writeCards({ tenantId, date: cardDate, cards });

  return {
    tenant_id: tenantId,
    card_date: cardDate,
    cards_written: cards.length,
    source: 'review_classifications',
  };
}
