function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.STORAGE_URL || process.env.POSTGRES_URL;
}

export async function dbQuery(sql, params = []) {
  const { neon } = await import("@neondatabase/serverless");
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    throw new Error("missing_database_url");
  }

  const query = neon(databaseUrl);
  return query.query(sql, params);
}
