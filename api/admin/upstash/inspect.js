function requireAdminToken(req) {
  const expected = process.env.ADMIN_TOKEN || process.env.MIGRATION_TOKEN;
  const provided = req.query.token || req.headers["x-admin-token"];
  return Boolean(expected && provided && provided === expected);
}

function requireUpstashEnv() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.KV_REST_API_READ_ONLY_TOKEN;

  if (!url || !token) {
    throw new Error("missing_upstash_env");
  }

  return { url: url.replace(/\/$/, ""), token };
}

function sanitizePattern(pattern) {
  if (typeof pattern !== "string" || !pattern.trim()) {
    return "gmb:*";
  }

  const clean = pattern.trim();

  if (!clean.startsWith("gmb:")) {
    throw new Error("pattern_not_allowed");
  }

  return clean;
}

function sanitizeKey(key) {
  if (typeof key !== "string" || !key.trim()) {
    throw new Error("key_required");
  }

  const clean = key.trim();

  if (!clean.startsWith("gmb:")) {
    throw new Error("key_not_allowed");
  }

  return clean;
}

function parsePositiveInt(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function previewValue(value, maxChars) {
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  return {
    length: raw.length,
    preview: raw.length > maxChars ? `${raw.slice(0, maxChars)}...` : raw,
  };
}

async function upstashCommand(command) {
  const { url, token } = requireUpstashEnv();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error("upstash_request_failed");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (payload?.error) {
    const error = new Error("upstash_command_failed");
    error.payload = payload;
    throw error;
  }

  return payload?.result;
}

async function scanKeys({ pattern, count, maxKeys }) {
  let cursor = "0";
  const keys = [];

  do {
    const result = await upstashCommand(["SCAN", cursor, "MATCH", pattern, "COUNT", count]);
    cursor = String(result?.[0] ?? "0");
    const batch = Array.isArray(result?.[1]) ? result[1] : [];

    for (const key of batch) {
      if (typeof key === "string" && key.startsWith("gmb:")) {
        keys.push(key);
      }
      if (keys.length >= maxKeys) break;
    }
  } while (cursor !== "0" && keys.length < maxKeys);

  return { cursor, keys };
}

async function inspectKey({ key, maxChars }) {
  const type = await upstashCommand(["TYPE", key]);
  let value = null;

  if (type === "string") {
    value = await upstashCommand(["GET", key]);
  } else if (type === "list") {
    value = await upstashCommand(["LRANGE", key, 0, 9]);
  } else if (type === "set") {
    value = await upstashCommand(["SMEMBERS", key]);
  } else if (type === "zset") {
    value = await upstashCommand(["ZRANGE", key, 0, 9, "WITHSCORES"]);
  } else if (type === "hash") {
    value = await upstashCommand(["HGETALL", key]);
  }

  return {
    key,
    type,
    ...previewValue(value, maxChars),
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  if (!requireAdminToken(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const action = req.query.action || "scan";
  const maxChars = parsePositiveInt(req.query.max_chars, 1200, 10000);

  try {
    if (action === "scan") {
      const pattern = sanitizePattern(req.query.pattern);
      const count = parsePositiveInt(req.query.count, 100, 1000);
      const maxKeys = parsePositiveInt(req.query.max_keys, 100, 500);
      const result = await scanKeys({ pattern, count, maxKeys });
      return res.status(200).json({ ok: true, action, pattern, count, max_keys: maxKeys, ...result });
    }

    if (action === "get") {
      const key = sanitizeKey(req.query.key);
      const result = await inspectKey({ key, maxChars });
      return res.status(200).json({ ok: true, action, ...result });
    }

    if (action === "preview") {
      const pattern = sanitizePattern(req.query.pattern);
      const count = parsePositiveInt(req.query.count, 100, 1000);
      const maxKeys = parsePositiveInt(req.query.max_keys, 20, 50);
      const scan = await scanKeys({ pattern, count, maxKeys });
      const items = [];

      for (const key of scan.keys) {
        items.push(await inspectKey({ key, maxChars }));
      }

      return res.status(200).json({ ok: true, action, pattern, keys_found: scan.keys.length, items });
    }

    return res.status(400).json({ ok: false, error: "unknown_action" });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      error: error.message,
      details: error.payload || null,
    });
  }
}
