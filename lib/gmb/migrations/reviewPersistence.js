import { dbQuery } from "../postgres.js";

export async function resolveTenantId(placeId) {
  const rows = await dbQuery(
    `select tenant_id
     from places
     where place_id = $1
     limit 1`,
    [placeId]
  );

  return rows[0]?.tenant_id || null;
}

export async function upsertReview({ review, tenantId }) {
  await dbQuery(
    `insert into place_reviews (
      tenant_id,
      place_id,
      review_hash,
      captured_date,
      captured_at,
      updated_at,
      author,
      review_date,
      rating,
      text,
      language,
      original_text,
      original_language,
      source,
      raw
    ) values ($1,$2,$3,$4,$5,now(),$6,$7,$8,$9,$10,$11,$12,$13,$14)
    on conflict (tenant_id, place_id, review_hash)
    do update set
      captured_date = excluded.captured_date,
      updated_at = now(),
      author = excluded.author,
      review_date = excluded.review_date,
      rating = excluded.rating,
      text = excluded.text,
      language = excluded.language,
      original_text = excluded.original_text,
      original_language = excluded.original_language,
      source = excluded.source,
      raw = excluded.raw`,
    [
      tenantId,
      review.place_id,
      review.review_hash,
      review.captured_date,
      review.captured_at || null,
      review.author || null,
      review.review_date || null,
      review.rating ?? null,
      review.text || null,
      review.language || null,
      review.original_text || null,
      review.original_language || null,
      review.source || "upstash_migration",
      JSON.stringify(review),
    ]
  );
}
