import { gmbCaptureKeys } from "./keys.js";
import { redisCommand } from "./redis.js";
import { resolvePlacesFromPostgres } from "./placeResolver.js";

const DEFAULT_STORE_ROLES = ["dealer", "service", "parts", "all"];

function safeJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function confidence(n) {
  if (n < 10) return "baja";
  if (n < 30) return "media";
  return "alta";
}

function groupByLocation(places) {
  return places.reduce((acc, place) => {
    const location = place.normalized_location || place.location;
    const brand = place.brand || place.name;

    if (!location || !brand) return acc;
    if (!acc[location]) acc[location] = [];
    acc[location].push({ ...place, location, brand });

    return acc;
  }, {});
}

async function getSnapshot(date, placeId, tenantId) {
  const raw = await redisCommand(["GET", gmbCaptureKeys.snapshot(date, placeId, tenantId)]);
  return safeJson(raw);
}

function buildStore(place, snapshot) {
  const reviewsCount = snapshot.review_count ?? 0;

  return {
    brand: place.brand,
    name: place.name || snapshot.name,
    place_id: place.place_id,
    ownership_group: place.ownership_group || null,
    store_role: place.store_role || null,
    rating: snapshot.rating ?? 0,
    reviews_count: reviewsCount,
    confidence: confidence(reviewsCount),
  };
}

function isOwned(item) {
  return item.ownership_group === "own";
}

function eligibleTop(ranking) {
  return ranking.find((item) => item.confidence !== "baja") || ranking[0] || null;
}

function buildOwnedSummary(ranking) {
  const owned = ranking.find(isOwned);
  const top = eligibleTop(ranking);

  if (!owned || !top) return null;

  return {
    position: ranking.indexOf(owned) + 1,
    brand: owned.brand,
    rating: owned.rating,
    reviews: owned.reviews_count,
    confidence: owned.confidence,
    gap_vs_top: +(top.rating - owned.rating).toFixed(2),
    place_id: owned.place_id,
  };
}

function filterByRole(ranking, role) {
  if (role === "all") return ranking;
  return ranking.filter((item) => item.store_role === role);
}

function buildSummary(location, ranking) {
  if (ranking.length === 0) return null;

  return {
    location,
    stores_count: ranking.length,
    owned_count: ranking.filter(isOwned).length,
    competitor_count: ranking.filter((item) => item.ownership_group === "competitor").length,
    top: eligibleTop(ranking),
    owned: buildOwnedSummary(ranking),
  };
}

async function saveRoleIndexes({ date, role, rankingsByLocation, tenantId }) {
  const locations = [];

  for (const [location, baseRanking] of Object.entries(rankingsByLocation)) {
    const ranking = filterByRole(baseRanking, role);
    const summary = buildSummary(location, ranking);

    await redisCommand(["SET", gmbCaptureKeys.locationRanking(date, location, role, tenantId), JSON.stringify(ranking)]);
    if (summary) locations.push(summary);
  }

  await redisCommand(["SET", gmbCaptureKeys.index(date, `locations:${role}`, tenantId), JSON.stringify(locations)]);
  return locations;
}

function getStoreRoles(places) {
  return [...new Set([...DEFAULT_STORE_ROLES, ...places.map((place) => place.store_role).filter(Boolean)])];
}

export async function buildLocationIndexes(date, { tenantId = "cidef" } = {}) {
  const places = await resolvePlacesFromPostgres({ tenant_id: tenantId, filters: {} });
  const byLocation = groupByLocation(places);
  const rankingsByLocation = {};

  for (const [location, locationPlaces] of Object.entries(byLocation)) {
    const ranking = [];

    for (const place of locationPlaces) {
      const snapshot = await getSnapshot(date, place.place_id, tenantId);
      if (snapshot) ranking.push(buildStore(place, snapshot));
    }

    ranking.sort((a, b) => b.rating - a.rating || b.reviews_count - a.reviews_count);
    rankingsByLocation[location] = ranking;
  }

  const roleLocations = {};
  const counts = {};

  for (const role of getStoreRoles(places)) {
    roleLocations[role] = await saveRoleIndexes({ date, role, rankingsByLocation, tenantId });
    counts[role] = roleLocations[role].length;
  }

  const defaultLocations = roleLocations.all || roleLocations.dealer || [];
  await redisCommand(["SET", gmbCaptureKeys.index(date, "locations", tenantId), JSON.stringify(defaultLocations)]);

  return {
    locations: defaultLocations.length,
    ranked_locations: defaultLocations.length,
    role_locations: counts,
  };
}
