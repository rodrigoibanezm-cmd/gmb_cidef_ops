import { rebuildOperationalCards } from "../../lib/dashboard/operationalCards.js";
import { dbQuery } from "../../lib/gmb/postgres.js";

const CLASSIFICATION_VERSION = "v1";
const VALID_SCOPES = new Set(["own", "competitor", "all"]);

function cleanText(value, fallback = "") {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim();
  return clean || fallback;
}

function excerpt(value, max = 800) {
  const clean = cleanText(value);
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function parseLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(Math.floor(parsed), 50);
}

function parseScope(value) {
  const scope = cleanText(value || "own").toLowerCase();
  return VALID_SCOPES.has(scope) ? scope : null;
}

function parseAction(value) {
  const action = cleanText(value || "pending").toLowerCase();
  return ["pending", "commit", "rebuild"].includes(action) ? action : null;
}

function requireTenantId(req) {
  const value = req.query.tenant_id || req.query.tenant || req.body?.tenant_id || req.body?.tenant;
  const tenantId = cleanText(value).toLowerCase();
  if (!tenantId) throw new Error("tenant_id_required");
  return tenantId === "autos" ? "cidef" : tenantId;
}

function boundedInt(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(4, Math.floor(parsed)));
}

function normalizeClassification(raw) {
  const topicPrimary = cleanText(raw.topic_primary || raw.topic || "otro").toLowerCase();
  const text = cleanText(raw.evidence_excerpt || raw.summary || raw.safe_label || "");

  return {
    tenant_id: cleanText(raw.tenant_id).toLowerCase(),
    place_id: cleanText(raw.place_id),
    review_hash: cleanText(raw.review_hash),
    topic_primary: topicPrimary || "otro",
    core: boundedInt(raw.core, raw.severity === "critical" || raw.severity === "high" ? 4 : 2),
    operational_impact: boundedInt(raw.operational_impact, 2),
    trust_impact: boundedInt(raw.trust_impact, 2),
    legal_flag: Boolean(raw.legal_flag),
    evidence_excerpt: excerpt(text, 500),
    raw_llm: raw.raw_llm || raw,
  };
}

async function ensureReviewClassificationV1() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS review_classifications (
      tenant_id TEXT NOT NULL,
      place_id TEXT NOT NULL,
      review_hash TEXT NOT NULL,
      classification_version TEXT NOT NULL DEFAULT 'v1',
      classified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      raw_llm JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);

  await dbQuery(`ALTER TABLE review_classifications ADD COLUMN IF NOT EXISTS topic_primary TEXT`);
  await dbQuery(`ALTER TABLE review_classifications ADD COLUMN IF NOT EXISTS core INTEGER`);
  await dbQuery(`ALTER TABLE review_classifications ADD COLUMN IF NOT EXISTS operational_impact INTEGER`);
  await dbQuery(`ALTER TABLE review_classifications ADD COLUMN IF NOT EXISTS trust_impact INTEGER`);
  await dbQuery(`ALTER TABLE review_classifications ADD COLUMN IF NOT EXISTS legal_flag BOOLEAN`);
  await dbQuery(`ALTER TABLE review_classifications ADD COLUMN IF NOT EXISTS evidence_excerpt TEXT`);

  await dbQuery(`ALTER TABLE review_classifications ADD COLUMN IF NOT EXISTS topic TEXT`);
  await dbQuery(`ALTER TABLE review_classifications ADD COLUMN IF NOT EXISTS sentiment TEXT`);
  await dbQuery(`ALTER TABLE review_classifications ADD COLUMN IF NOT EXISTS severity TEXT`);
  await dbQuery(`ALTER TABLE review_classifications ADD COLUMN IF NOT EXISTS risk_type TEXT`);
  await dbQuery(`ALTER TABLE review_classifications ADD COLUMN IF NOT EXISTS requires_alert BOOLEAN`);
  await dbQuery(`ALTER TABLE review_classifications ADD COLUMN IF NOT EXISTS needs_human_review BOOLEAN`);
  await dbQuery(`ALTER TABLE review_classifications ADD COLUMN IF NOT EXISTS safe_label TEXT`);
  await dbQuery(`ALTER TABLE review_classifications ADD COLUMN IF NOT EXISTS summary TEXT`);

  await dbQuery(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_review_classifications_v1_identity
    ON review_classifications (tenant_id, place_id, review_hash, classification_version)
  `);
}

async function readMissingReviews({ tenantId, scope, limit }) {
  await ensureReviewClassificationV1();

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
       p.brand,
       p.operator
     from place_reviews r
     join places p on p.tenant_id = r.tenant_id and p.place_id = r.place_id
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

async function saveClassification(item) {
  const section = classifySectionPreview(item);
  const severity = item.core >= 4 ? "high" : item.core >= 3 ? "medium" : "low";
  const riskType = item.legal_flag ? "legal_reputacional" : item.trust_impact >= 3 ? "reputacional" : "operacional";
  const summary = `core=${item.core}; operational=${item.operational_impact}; trust=${item.trust_impact}; legal=${item.legal_flag}`;

  const rows = await dbQuery(
    `insert into review_classifications (
       tenant_id, place_id, review_hash, classification_version,
       topic_primary, core, operational_impact, trust_impact, legal_flag,
       evidence_excerpt, classified_at, raw_llm,
       topic, sentiment, severity, risk_type, requires_alert, needs_human_review, safe_label, summary
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),$11,$5,'negative',$12,$13,$14,false,$15,$16)
     on conflict (tenant_id, place_id, review_hash, classification_version)
     do update set
       topic_primary = excluded.topic_primary,
       core = excluded.core,
       operational_impact = excluded.operational_impact,
       trust_impact = excluded.trust_impact,
       legal_flag = excluded.legal_flag,
       evidence_excerpt = excluded.evidence_excerpt,
       classified_at = now(),
       raw_llm = excluded.raw_llm,
       topic = excluded.topic,
       sentiment = excluded.sentiment,
       severity = excluded.severity,
       risk_type = excluded.risk_type,
       requires_alert = excluded.requires_alert,
       needs_human_review = excluded.needs_human_review,
       safe_label = excluded.safe_label,
       summary = excluded.summary
     returning (xmax = 0) as inserted`,
    [
      item.tenant_id,
      item.place_id,
      item.review_hash,
      CLASSIFICATION_VERSION,
      item.topic_primary,
      item.core,
      item.operational_impact,
      item.trust_impact,
      item.legal_flag,
      item.evidence_excerpt,
      JSON.stringify(item.raw_llm),
      severity,
      riskType,
      section === "urgente",
      item.topic_primary,
      summary,
    ]
  );

  return Boolean(rows[0]?.inserted);
}

function classifySectionPreview(item) {
  if (item.legal_flag || (item.core === 4 && item.operational_impact >= 3)) return "urgente";
  if (item.core >= 3 || item.trust_impact >= 3 || item.operational_impact >= 3) return "importante";
  return "tareas";
}

async function handlePending(req, res, tenantId) {
  const scope = parseScope(req.query.scope);
  if (!scope) return res.status(400).json({ ok: false, error: "invalid_scope", valid_scopes: [...VALID_SCOPES] });

  const limit = parseLimit(req.query.limit);
  const rows = await readMissingReviews({ tenantId, scope, limit });

  return res.status(200).json({
    ok: true,
    action: "pending",
    mode: "operational_review_classification_v1",
    tenant_id: tenantId,
    scope,
    classification_version: CLASSIFICATION_VERSION,
    llm_contract: {
      fields: ["topic_primary", "core", "operational_impact", "trust_impact", "legal_flag"],
      scale: "core/operational_impact/trust_impact: integer 1-4",
      legal_flag: "boolean decided semantically by LLM, not regex",
    },
    pending_count: rows.length,
    has_pending: rows.length > 0,
    reviews: rows.map((row) => ({
      tenant_id: row.tenant_id,
      place_id: row.place_id,
      review_hash: row.review_hash,
      author: row.author,
      review_date: row.review_date,
      rating: row.rating,
      text: excerpt(row.text, 1200),
      place_name: row.place_name,
      normalized_location: row.normalized_location,
      ownership_group: row.ownership_group,
      brand: row.brand,
      operator: row.operator,
    })),
  });
}

async function handleCommit(req, res) {
  await ensureReviewClassificationV1();

  const items = Array.isArray(req.body?.classifications) ? req.body.classifications : [];
  if (!items.length) return res.status(400).json({ ok: false, error: "classifications_required" });

  const saved = [];
  const inserted = [];
  const errors = [];

  for (const raw of items) {
    try {
      const item = normalizeClassification(raw);
      if (!item.tenant_id || !item.place_id || !item.review_hash) throw new Error("missing_identity_fields");
      const wasInserted = await saveClassification(item);
      saved.push(item);
      if (wasInserted) inserted.push(item);
    } catch (error) {
      errors.push({ message: error.message, item: raw });
    }
  }

  const tenants = [...new Set(saved.map((item) => item.tenant_id))];
  const rebuilds = [];
  const rebuildErrors = [];

  if (saved.length > 0) {
    for (const tenantId of tenants) {
      try {
        rebuilds.push(await rebuildOperationalCards({ tenantId }));
      } catch (error) {
        rebuildErrors.push({ tenant_id: tenantId, code: error.code || "operational_cards_rebuild_failed", message: error.message });
      }
    }
  }

  return res.status(200).json({
    ok: errors.length === 0 && rebuildErrors.length === 0,
    action: "commit",
    classification_version: CLASSIFICATION_VERSION,
    received: items.length,
    saved: saved.length,
    inserted: inserted.length,
    updated: saved.length - inserted.length,
    failed: errors.length,
    classification_changed: saved.length > 0,
    new_signal_possible: inserted.length > 0,
    operational_cards_rebuilt: rebuilds.length > 0,
    operational_cards: rebuilds,
    operational_cards_errors: rebuildErrors,
    results: saved.map((item) => ({
      tenant_id: item.tenant_id,
      place_id: item.place_id,
      review_hash: item.review_hash,
      topic_primary: item.topic_primary,
      core: item.core,
      operational_impact: item.operational_impact,
      trust_impact: item.trust_impact,
      legal_flag: item.legal_flag,
    })),
    errors,
  });
}

async function handleRebuild(req, res) {
  const tenantId = requireTenantId(req);
  const result = await rebuildOperationalCards({ tenantId, date: req.query.date || req.body?.date || null });
  return res.status(200).json({ ok: true, action: "rebuild", ...result });
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const action = parseAction(req.query.action || req.body?.action);
    if (!action) return res.status(400).json({ ok: false, error: "invalid_action", valid_actions: ["pending", "commit", "rebuild"] });

    if (action === "commit") {
      if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });
      return handleCommit(req, res);
    }

    if (action === "rebuild") {
      if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });
      return handleRebuild(req, res);
    }

    return handlePending(req, res, requireTenantId(req));
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message || "classify_missing_failed" });
  }
}
