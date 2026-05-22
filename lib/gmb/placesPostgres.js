import { dbQuery } from "./postgres.js";

export async function getPlaceIdsFromPostgres({ tenantId = "cidef" } = {}) {
  const rows = await dbQuery(
    `select place_id
     from places
     where tenant_id = $1
       and coalesce(status, 'keep') = 'keep'
     order by place_id`,
    [tenantId]
  );

  return rows.map((row) => row.place_id);
}
