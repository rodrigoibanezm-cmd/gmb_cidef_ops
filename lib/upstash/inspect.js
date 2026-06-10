import { redis } from "./client.js";

function asPreview(value, maxChars) {
  const raw = typeof value === "string" ? value : JSON.stringify(value);

  return {
    length: raw.length,
    preview: raw.length > maxChars ? `${raw.slice(0, maxChars)}...` : raw,
  };
}

export async function inspectKey(key, maxChars) {
  const type = await redis(["TYPE", key]);
  let value = null;

  if (type === "string") value = await redis(["GET", key]);
  else if (type === "list") value = await redis(["LRANGE", key, 0, 9]);
  else if (type === "set") value = await redis(["SMEMBERS", key]);
  else if (type === "zset") value = await redis(["ZRANGE", key, 0, 9, "WITHSCORES"]);
  else if (type === "hash") value = await redis(["HGETALL", key]);

  return { key, type, ...asPreview(value, maxChars) };
}
