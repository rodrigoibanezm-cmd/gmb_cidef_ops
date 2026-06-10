function getRedisEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_READ_ONLY_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) throw new Error("missing_redis_env");
  return { url: url.replace(/\/$/, ""), token };
}

export async function redis(command) {
  const { url, token } = getRedisEnv();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.error) {
    const error = new Error("redis_request_failed");
    error.status = response.status;
    error.details = payload;
    throw error;
  }

  return payload?.result;
}

export function parseRedisJson(raw, label) {
  if (typeof raw !== "string" || !raw.trim()) throw new Error(`${label}_empty`);
  return JSON.parse(raw);
}
