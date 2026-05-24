export default async function handler(req, res) {
  return res.status(410).json({
    ok: false,
    error: "endpoint_removed",
    message: "Redis/Upstash backfill flow removed. Metrics are now written directly to Neon during capture.",
  });
}
