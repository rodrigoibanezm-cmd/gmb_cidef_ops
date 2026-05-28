import { rebuildOperationalCards } from "../../lib/dashboard/operationalCards.js";
import { dbQuery } from "../../lib/gmb/postgres.js";

const CLASSIFICATION_VERSION = "v1";
const VALID_SCOPES = new Set(["own", "competitor", "all"]);
const VALID_TOPICS = new Set([
  "atencion",
  "trato_cliente",
  "ecommerce",
  "postventa",
  "despacho",
  "precio",
  "producto",
  "stock",
  "seguridad",
  "legal_reputacional",
  "otro",
]);
const VALID_SENTIMENTS = new Set(["positive", "neutral", "negative", "mixed"]);
const VALID_SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const VALID_RISK_TYPES = new Set([
  "none",
  "operacional",
  "reputacional",
  "legal",
  "seguridad",
  "legal_reputacional",
  "fraude_acusacion",
]);

function requireTenantId(req) {
  const tenantId = req.query.tenant_id || req.query.tenant;
  return typeof tenantId === "string" && tenantId.trim() ? tenantId.trim() : null;
}

function parseLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(Math.floor(parsed), 50);
}

function parseScope(value) {
  const scope = typeof value === "string" && value.trim() ? value.trim() : "own";
  return VALID_SCOPES.has(scope) ? scope : null;
}

function parseAction(value) {
  const action = typeof value === "string" && value.trim() ? value.trim() : "pending";
  return action === "pending" || action === "commit" ? action : null;
}

function normalizeEnum(value, allowed, fallback) {
  const clean = typeof value === "string" ? value.trim() : "";
  return allowed.has(clean) ? clean : fallback;
}

function excerpt(text, max = 600) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function uniqueTenantIdFromSaved(saved) {
  const tenants = [...new Set(saved.map((item) => item.tenant_id).filter(Boolean))];
  return tenants.length === 1 ? tenants[0] : null;
}

async function readMissingReviews({ tenantId, scope, limit }) {
  const params = [tenantId, CLASSIFICATION_VERSION, limit];
  const scopeFilter = scope === "all" ? "" : "and p.ownership_group = $4";
  if (scope !== "all") params.push(scope);

  return dbQuery(
    `select
       r.tenant_id,
       r.place_id,
       r.review_hash,
       r.author,
       r.review_date,
       r.rating,
       r.text,
       p.name as place_name,
       p.normalized_location,
       p.ownership_group,
       p.brand
     from place_reviews r
     join places p
       on p.tenant_id = r.tenant_id
      and p.place_id = r.place_id
     where r.tenant_id = $1
       and coalesce(p.status, 'keep') = 'keep'
       and coalesce(r.text, '') <> ''
       ${scopeFilter}
       and not exists (
         select 1
         from review_classifications c
         where c.tenant_id = r.tenant_id
           and c.place_id = r.place_id
           and c.review_hash = r.review_hash
           and c.classification_version = $2
       )
     order by r.review_date desc nulls last
     limit $3`,
    params
  );
}

function normalizeClassification(item) {
  return {
    tenant_id: String(item.tenant_id || "").trim(),
    place_id: String(item.place_id || "").trim(),
    review_hash: String(item.review_hash || "").trim(),
    topic: normalizeEnum(item.topic, VALID_TOPICS, "otro"),
    sentiment: normalizeEnum(item.sentiment, VALID_SENTIMENTS, "neutral"),
    severity: normalizeEnum(item.severity, VALID_SEVERITIES, "low"),
    risk_type: normalizeEnum(item.risk_type, VALID_RISK_TYPES, "none"),
    requires_alert: Boolean(item.requires_alert),
    needs_human_review: Boolean(item.needs_human_review),
    safe_label: excerpt(item.safe_label || "Sin alerta", 120),
    summary: excerpt(item.summary || "Review clasificada.", 300),
    evidence_excerpt: excerpt(item.evidence_excerpt || "", 300),
    raw_llm: item.raw_llm || item,
  };
}

async function saveClassification(item) {
  await dbQuery(
    `insert into review_classifications (
       tenant_id,
       place_id,
       review_hash,
       classification_version,
       topic,
       sentiment,
       severity,
       risk_type,
       requires_alert,
       needs_human_review,
       safe_label,
       summary,
       evidence_excerpt,
       classified_at,
       raw_llm
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),$14)
     on conflict (tenant_id, place_id, review_hash, classification_version)
     do update set
       topic = excluded.topic,
       sentiment = excluded.sentiment,
       severity = excluded.severity,
       risk_type = excluded.risk_type,
       requires_alert = excluded.requires_alert,
       needs_human_review = excluded.needs_human_review,
       safe_label = excluded.safe_label,
       summary = excluded.summary,
       evidence_excerpt = excluded.evidence_excerpt,
       classified_at = now(),
       raw_llm = excluded.raw_llm`,
    [
      item.tenant_id,
      item.place_id,
      item.review_hash,
      CLASSIFICATION_VERSION,
      item.topic,
      item.sentiment,
      item.severity,
      item.risk_type,
      item.requires_alert,
      item.needs_human_review,
      item.safe_label,
      item.summary,
      item.evidence_excerpt,
      JSON.stringify(item.raw_llm),
    ]
  );
}

async function handlePending(req, res, tenantId) {
  const scope = parseScope(req.query.scope);
  if (!scope) {
    return res.status(400).json({ ok: false, error: "invalid_scope", valid_scopes: [...VALID_SCOPES] });
  }

  const limit = parseLimit(req.query.limit);
  const rows = await readMissingReviews({ tenantId, scope, limit });

  return res.status(200).json({
    ok: true,
    action: "pending",
    mode: "agent_driven_classification_pending",
    tenant_id: tenantId,
    scope,
    classification_version: CLASSIFICATION_VERSION,
    limit,
    pending_count: rows.length,
    has_pending: rows.length > 0,
    reviews: rows.map((row) => ({
      tenant_id: row.tenant_id,
      place_id: row.place_id,
      review_hash: row.review_hash,
      author: row.author,
      review_date: row.review_date,
      rating: row.rating,
      text: excerpt(row.text),
      place_name: row.place_name,
      normalized_location: row.normalized_location,
      ownership_group: row.ownership_group,
      brand: row.brand,
    })),
  });
}

async function handleCommit(req, res) {
  const items = Array.isArray(req.body?.classifications) ? req.body.classifications : [];
  if (!items.length) {
    return res.status(400).json({ ok: false, error: "classifications_required" });
  }

  const saved = [];
  const errors = [];

  for (const raw of items) {
    try {
      const item = normalizeClassification(raw);
      if (!item.tenant_id || !item.place_id || !item.review_hash) throw new Error("missing_identity_fields");
      await saveClassification(item);
      saved.push({
        tenant_id: item.tenant_id,
        place_id: item.place_id,
        review_hash: item.review_hash,
        severity: item.severity,
        risk_type: item.risk_type,
        requires_alert: item.requires_alert,
        safe_label: item.safe_label,
      });
    } catch (error) {
      errors.push({ message: error.message, item: raw });
    }
  }

  let operationalCards = null;
  let operationalCardsError = null;
  const tenantId = uniqueTenantIdFromSaved(saved);

  if (saved.length > 0 && tenantId) {
    try {
      operationalCards = await rebuildOperationalCards({ tenantId });
    } catch (error) {
      operationalCardsError = {
        code: error.code || "operational_cards_rebuild_failed",
        message: error.message,
      };
    }
  }

  return res.status(200).json({
    ok: errors.length === 0,
    action: "commit",
    classification_version: CLASSIFICATION_VERSION,
    received: items.length,
    saved: saved.length,
    failed: errors.length,
    critical_alerts: saved.filter(item => item.severity === "critical").length,
    operational_cards_rebuilt: Boolean(operationalCards),
    operational_cards: operationalCards,
    operational_cards_error: operationalCardsError,
    results: saved,
    errors,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const action = parseAction(req.query.action);
  if (!action) {
    return res.status(400).json({ ok: false, error: "invalid_action", valid_actions: ["pending", "commit"] });
  }

  if (action === "commit") {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });
    return handleCommit(req, res);
  }

  const tenantId = requireTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ ok: false, error: "tenant_id_required" });
  }

  return handlePending(req, res, tenantId);
}
