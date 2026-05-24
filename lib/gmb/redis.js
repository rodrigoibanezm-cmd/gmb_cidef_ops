export async function redisCommand(command) {
  const response = await fetch(process.env.KV_REST_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    const error = new Error(`Upstash error: ${response.status}${details ? ` - ${details.slice(0, 500)}` : ""}`);
    error.status = response.status;
    error.details = details.slice(0, 1000);
    throw error;
  }

  const data = await response.json();
  return data.result;
}
