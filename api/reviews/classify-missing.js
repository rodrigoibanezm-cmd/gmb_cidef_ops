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

function getOpenAiKey() {
  return process.env.OPENAI_API_KEY;
}

function normalizeEnum(value, allowed, fallback) {
  const clean = typeof value === "string" ? value.trim() : "";
  return allowed.has(clean) ? clean : fallback;
}

function excerpt(text, max = 280) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function heuristicClassification(review) {
  const text = String(review.text || "").toLowerCase();
  const saysTheftAccusation = /(acus|culp).{0,40}(robo|robar|hurt|delito)|me acus.{0,40}(robo|robar|hurt|delito)|(robo|robar|hurt|delito).{0,40}(acus)/i.test(text);
  const seriousCommerce = /(estafa|fraude|sernac|denuncia|demanda|me cobraron|no llegó|no llego|no responden|no hay telefono|no hay teléfono)/i.test(text);

  if (saysTheftAccusation) {
    return {
      topic: "trato_cliente",
      sentiment: "negative",
      severity: "critical",
      risk_type: "legal_reputacional",
      requires_alert: true,
      needs_human_review: true,
      safe_label: "Acusación grave al cliente",
      summary: "Cliente reporta haber sido acusada de robo, hurto o delito por personal de tienda.",
      evidence_excerpt: excerpt(review.text),
    };
  }

  if (seriousCommerce) {
    return {
      topic: "ecommerce",
      sentiment: "negative",
      severity: "high",
      risk_type: "operacional",
      requires_alert: true,
      needs_human_review: true,
      safe_label: "Reclamo grave de postventa",
      summary: "Cliente reporta problema grave de compra, entrega o falta de respuesta.",
      evidence_excerpt: excerpt(review.text),
    };
  }

  return null;
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

function buildPrompt(review) {
  return `Clasifica esta review de Google Places para riesgo reputacional/operacional/legal.

Reglas críticas:
- Si el cliente reporta que personal de tienda lo acusó de robo, hurto o delito, clasifica severity=critical, risk_type=legal_reputacional, requires_alert=true, needs_human_review=true, safe_label="Acusación grave al cliente".
- No afirmes que hubo robo. Informa que el cliente reporta una acusación.
- Si hay estafa, fraude, denuncia, SERNAC, cobro sin entrega o falta grave de respuesta, requiere alerta.

Devuelve solo JSON válido con estos campos:
topic, sentiment, severity, risk_type, requires_alert, needs_human_review, safe_label, summary, evidence_excerpt.

Valores válidos:
topic: atencion, trato_cliente, ecommerce, postventa, despacho, precio, producto, stock, seguridad, legal_reputacional, otro
sentiment: positive, neutral, negative, mixed
severity: low, medium, high, critical
risk_type: none, operacional, reputacional, legal, seguridad, legal_reputacional, fraude_acusacion

Tienda: ${review.place_name || ""}
Ubicación: ${review.normalized_location || ""}
Rating: ${review.rating ?? ""}
Review: ${review.text || ""}`;
}

async function classifyWithOpenAI(review) {
  const heuristic = heuristicClassification(review);
  if (heuristic) return { ...heuristic, source: "heuristic_guardrail" };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.REVIEW_CLASSIFIER_MODEL || "gpt-4.1-mini",
      input: buildPrompt(review),
      temperature: 0,
      text: { format: { type: "json_object" } },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    const error = new Error(`openai_error_${response.status}`);
    error.details = details.slice(0, 500);
    throw error;
  }

  const data = await response.json();
  const content = data.output_text || data.output?.flatMap(item => item.content || []).find(item => item.type === "output_text")?.text;
  const parsed = JSON.parse(content || "{}");

  return { ...parsed, source: "openai", raw_response: data };
}

function normalizeClassification(raw, review) {
  return {
    topic: normalizeEnum(raw.topic, VALID_TOPICS, "otro"),
    sentiment: normalizeEnum(raw.sentiment, VALID_SENTIMENTS, Number(review.rating) >= 4 ? "positive" : Number(review.rating) <= 2 ? "negative" : "neutral"),
    severity: normalizeEnum(raw.severity, VALID_SEVERITIES, Number(review.rating) <= 2 ? "medium" : "low"),
    risk_type: normalizeEnum(raw.risk_type, VALID_RISK_TYPES, "none"),
    requires_alert: Boolean(raw.requires_alert),
    needs_human_review: Boolean(raw.needs_human_review),
    safe_label: excerpt(raw.safe_label || "Sin alerta", 120),
    summary: excerpt(raw.summary || "Review clasificada sin hallazgo crítico.", 300),
    evidence_excerpt: excerpt(raw.evidence_excerpt || review.text, 300),
    raw_llm: raw,
  };
}

async function saveClassification(review, classification) {
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
      review.tenant_id,
      review.place_id,
      review.review_hash,
      CLASSIFICATION_VERSION,
      classification.topic,
      classification.sentiment,
      classification.severity,
      classification.risk_type,
      classification.requires_alert,
      classification.needs_human_review,
      classification.safe_label,
      classification.summary,
      classification.evidence_excerpt,
      JSON.stringify(classification.raw_llm),
    ]
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const tenantId = requireTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ ok: false, error: "tenant_id_required" });
  }

  const scope = parseScope(req.query.scope);
  if (!scope) {
    return res.status(400).json({ ok: false, error: "invalid_scope", valid_scopes: [...VALID_SCOPES] });
  }

  if (!getOpenAiKey()) {
    return res.status(500).json({ ok: false, error: "openai_api_key_missing" });
  }

  const limit = parseLimit(req.query.limit);
  const rows = await readMissingReviews({ tenantId, scope, limit });
  const results = [];
  const errors = [];

  for (const review of rows) {
    try {
      const raw = await classifyWithOpenAI(review);
      const classification = normalizeClassification(raw, review);
      await saveClassification(review, classification);
      results.push({
        place_id: review.place_id,
        review_hash: review.review_hash,
        place_name: review.place_name,
        severity: classification.severity,
        risk_type: classification.risk_type,
        requires_alert: classification.requires_alert,
        needs_human_review: classification.needs_human_review,
        safe_label: classification.safe_label,
        summary: classification.summary,
      });
    } catch (error) {
      errors.push({
        place_id: review.place_id,
        review_hash: review.review_hash,
        message: error.message,
        details: error.details || null,
      });
    }
  }

  const alerts = results.filter(item => item.requires_alert);

  return res.status(200).json({
    ok: errors.length === 0,
    tenant_id: tenantId,
    scope,
    classification_version: CLASSIFICATION_VERSION,
    requested_limit: limit,
    found_missing: rows.length,
    classified: results.length,
    failed: errors.length,
    alerts: alerts.length,
    critical_alerts: alerts.filter(item => item.severity === "critical").length,
    high_alerts: alerts.filter(item => item.severity === "high").length,
    results,
    errors,
  });
}
