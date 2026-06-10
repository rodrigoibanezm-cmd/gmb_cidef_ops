import { discoverSnapshotDates, buildSnapshotDiscovery } from "./snapshotDiscovery.js";
import { migrateSnapshotDate } from "./snapshotProcessor.js";

export async function migrateSnapshots({
  tenantId,
  date,
  offsetPerDate,
  limitPerDate,
  limitDates,
  dryRun,
}) {
  const discovery = date
    ? buildSnapshotDiscovery({ tenantId, date })
    : await discoverSnapshotDates({ tenantId, limitDates });

  const dates = discovery.dates.slice(0, limitDates);
  const summaries = [];

  for (const currentDate of dates) {
    summaries.push(
      await migrateSnapshotDate({
        tenantId,
        date: currentDate,
        offset: offsetPerDate,
        limit: limitPerDate,
        dryRun,
      })
    );
  }

  return {
    tenant_id: tenantId,
    date,
    dry_run: dryRun,
    offset_per_date: offsetPerDate,
    limit_per_date: limitPerDate,
    limit_dates: limitDates,
    discovery,
    summaries,
    total_scanned: summaries.reduce((sum, item) => sum + item.scanned, 0),
    total_inserted_or_updated: summaries.reduce(
      (sum, item) => sum + item.inserted_or_updated,
      0
    ),
    total_failed: summaries.reduce((sum, item) => sum + item.failed, 0),
    done: summaries.every((item) => item.done) && discovery.scan_complete,
  };
}
