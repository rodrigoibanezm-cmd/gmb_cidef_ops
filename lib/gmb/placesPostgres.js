import { dbQuery } from "./postgres.js";

function requireTenantId(tenantId) {
  if (typeof tenantId !== "string" || !tenantId.trim()) {
    throw new Error("tenant_id_required");
  }

  return tenantId.trim();
}

export async function getPlaceIdsFromPostgres({ tenantId } = {}) {
  const resolvedTenantId = requireTenantId(tenantId);

  const rows = await dbQuery(
    `select place_id
     from places
     where tenant_id = $1
       and coalesce(status, 'keep') = 'keep'
     order by place_id`,
    [resolvedTenantId]
  );

  return rows.map((row) => row.place_id);
}
