export const CLASSIFIED_HASH_KEY = "gmb:classified:v1";

function prefix(tenantId = "cidef") {
  return `gmb:${tenantId}`;
}

export const gmbCaptureKeys = {
  classifiedHash: CLASSIFIED_HASH_KEY,
  run: (date, tenantId) => `${prefix(tenantId)}:capture:run:${date}`,
  reviewsRun: (date, tenantId) => `${prefix(tenantId)}:capture:reviews:run:${date}`,
  manifest: (date, tenantId) => `${prefix(tenantId)}:capture:manifest:${date}`,
  snapshot: (date, placeId, tenantId) => `${prefix(tenantId)}:snapshot:${date}:${placeId}`,
  review: (placeId, reviewHash, tenantId) => `${prefix(tenantId)}:review:${placeId}:${reviewHash}`,
  reviewSeen: (date, placeId, reviewHash, tenantId) => `${prefix(tenantId)}:review_seen:${date}:${placeId}:${reviewHash}`,
  legacyReview: (date, placeId, reviewHash, tenantId) => `${prefix(tenantId)}:review:${date}:${placeId}:${reviewHash}`,
  index: (date, name, tenantId) => `${prefix(tenantId)}:index:${date}:${name}`,
  placeReviewIndex: (date, placeId, tenantId) => `${prefix(tenantId)}:index:${date}:place:${placeId}:review_keys`,
  locationRanking: (date, location, role, tenantId) => `${prefix(tenantId)}:index:${date}:location:${location}:ranking:${role}`,
  indexDatePlaces: (date, tenantId) => `${prefix(tenantId)}:index:date:${date}:places`,
  indexPlaceDates: (placeId, tenantId) => `${prefix(tenantId)}:index:place:${placeId}:dates`,
};

export const gmbCapturePaths = {
  raw: (date, placeId, tenantId = "cidef") => `gmb/${tenantId}/raw/${date}/${placeId}.json`,
};
