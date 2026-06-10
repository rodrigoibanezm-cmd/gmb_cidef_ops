import { scanAllKeys } from "../../upstash/scan.js";

function extractSnapshotIndexDate(key, tenantId) {
  const pattern = new RegExp(
    `^gmb:${tenantId}:index:(\\d{4}-\\d{2}-\\d{2}):snapshot_keys$`
  );

  return key.match(pattern)?.[1] || null;
}

export function buildSnapshotDiscovery({ tenantId, date }) {
  return {
    pattern: `gmb:${tenantId}:index:${date}:snapshot_keys`,
    indexes_found: 1,
    dates: [date],
    scan_complete: true,
    scan_cursor: "0",
    scan_iterations: 0,
  };
}

export async function discoverSnapshotDates({ tenantId, limitDates }) {
  const pattern = `gmb:${tenantId}:index:*:snapshot_keys`;
  const scan = await scanAllKeys({ pattern, count: 1000, maxKeys: limitDates });
  const dates = scan.keys
    .map((key) => extractSnapshotIndexDate(key, tenantId))
    .filter(Boolean);

  return {
    pattern,
    indexes_found: scan.keys.length,
    dates: Array.from(new Set(dates)).sort(),
    scan_complete: scan.complete,
    scan_cursor: scan.cursor,
    scan_iterations: scan.iterations,
  };
}
