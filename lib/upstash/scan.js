import { redis } from "./client.js";

export async function scanKeys({ pattern, count, maxKeys, cursor = "0" }) {
  let nextCursor = cursor;
  const keys = [];

  do {
    const result = await redis(["SCAN", nextCursor, "MATCH", pattern, "COUNT", count]);
    nextCursor = String(result?.[0] || "0");
    const batch = Array.isArray(result?.[1]) ? result[1] : [];

    for (const key of batch) {
      if (typeof key === "string" && key.startsWith("gmb:")) {
        keys.push(key);
      }

      if (keys.length >= maxKeys) {
        break;
      }
    }
  } while (nextCursor !== "0" && keys.length < maxKeys);

  return {
    keys,
    next_cursor: nextCursor,
    done: nextCursor === "0",
  };
}

export async function scanAllKeys({ pattern, count, maxKeys }) {
  let cursor = "0";
  const keys = [];
  let iterations = 0;

  do {
    const result = await redis(["SCAN", cursor, "MATCH", pattern, "COUNT", count]);
    cursor = String(result?.[0] || "0");
    const batch = Array.isArray(result?.[1]) ? result[1] : [];

    for (const key of batch) {
      if (typeof key === "string" && key.startsWith("gmb:")) {
        keys.push(key);
      }

      if (keys.length >= maxKeys) {
        break;
      }
    }

    iterations += 1;
  } while (cursor !== "0" && keys.length < maxKeys);

  return {
    keys,
    cursor,
    iterations,
    complete: cursor === "0",
  };
}
