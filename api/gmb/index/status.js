export default async function handler(req, res) {
  return res.status(410).json({
    ok: false,
    error: "endpoint_removed",
    message: "Redis/Upstash index flow removed. Runtime now reads Neon directly.",
  });
}
