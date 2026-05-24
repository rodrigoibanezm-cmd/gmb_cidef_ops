import { dbQuery } from "./postgres.js";

function resolveTenantId(query = {}) {
  const tenantId = query.tenant_id || query.tenant || query.filters?.tenant_id;

  if (typeof tenantId !== "string" || !tenantId.trim()) {
    throw new Error("tenant_id_required");
  }

  return tenantId.trim();
}

function addFilter(clauses, params, sql, value) {
  params.push(value);
  clauses.push(sql.replace("$n", `$${params.length}`));
}

export async function resolvePlacesFromPostgres(query = {}) {
  const tenantId = resolveTenantId(query);
  const filters = query.filters || {};
  const clauses = ["tenant_id = $1", "coalesce(status, 'keep') = 'keep'"];
  const params = [tenantId];

  if (filters.location) {
    addFilter(clauses, params, "normalized_location = $n", filters.location);
  }

  if (filters.market_group) {
    addFilter(clauses, params, "market_group = $n", filters.market_group);
  }

  if (filters.region) {
    addFilter(clauses, params, "region = $n", filters.region);
  }

  if (filters.industry) {
    addFilter(clauses, params, "industry = $n", filters.industry);
  }

  if (filters.store_role && filters.store_role !== "all") {
    addFilter(clauses, params, "store_role = $n", filters.store_role);
  }

  if (filters.ownership_group && filters.ownership_group !== "all") {
    addFilter(clauses, params, "ownership_group = $n", filters.ownership_group);
  }

  if (filters.brand) {
    addFilter(clauses, params, "brand = $n", filters.brand);
  }

  const rows = await dbQuery(
    `
    select
      place_id,
      tenant_id,
      industry,
      brand,
      name,
      normalized_location as location,
      normalized_location,
      market_group,
      region,
      operator,
      store_role,
      ownership_group
    from places
    where ${clauses.join("\n      and ")}
    order by normalized_location nulls last, brand nulls last, place_id
    `,
    params
  );

  return rows.map((row) => ({
    ...row,
    location: row.location || "unknown",
  }));
}
