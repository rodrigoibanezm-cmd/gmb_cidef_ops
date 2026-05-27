import { dbQuery } from "../../lib/gmb/postgres.js";

const CLASSIFICATION_VERSION = "v1";
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

function normalizeEnum(value, allowed, fallback) {
  const clean = typeof value === "string" ? value.trim() : "";
  return allowed.has(clean) ? clean : fallback;
}

function excerpt(text, max = 400) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const items = Array.isArray(req.body?.classifications)
    ? req.body.classifications
    : [];

  if (!items.length) {
    return res.status(400).json({ ok: false, error: "classifications_required" });
  }

  const saved = [];
  const errors = [];

  for (const raw of items) {
    try {
      const item = normalizeClassification(raw);

      if (!item.tenant_id || !item.place_id || !item.review_hash) {
        throw new Error("missing_identity_fields");
      }

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
      errors.push({
        message: error.message,
        item: raw,
      });
    }
  }

  return res.status(200).json({
    ok: errors.length === 0,
    classification_version: CLASSIFICATION_VERSION,
    received: items.length,
    saved: saved.length,
    failed: errors.length,
    critical_alerts: saved.filter(item => item.severity === "critical").length,
    results: saved,
    errors,
  });
}
