import { dbQuery } from "../../lib/gmb/postgres.js";

const CLASSIFICATION_VERSION = "v1";
const VALID_SCOPES = new Set(["own", "competitor", "all"]);

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

function excerpt(text, max = 600) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
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

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
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

  const limit = parseLimit(req.query.limit);
  const rows = await readMissingReviews({ tenantId, scope, limit });

  return res.status(200).json({
    ok: true,
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
