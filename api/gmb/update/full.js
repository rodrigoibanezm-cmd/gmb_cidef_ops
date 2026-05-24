export default async function handler(req, res) {
  return res.status(410).json({
    ok: false,
    error: "endpoint_removed",
    message: "Redis/Upstash flow removed. Use /api/gmb/update/full-neon.",
  });
}
