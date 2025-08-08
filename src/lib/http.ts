export async function fetchJson<T>(url: string): Promise<T> {
  // Random jitter to avoid rate-limiting if run in parallel elsewhere
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}


