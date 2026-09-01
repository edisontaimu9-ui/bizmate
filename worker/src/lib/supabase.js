// Minimal Supabase REST (PostgREST) client. Uses the service_role key,
// which bypasses Row Level Security — the Worker is the real trust
// boundary here (see db/schema.sql for why). Never send SUPABASE_SERVICE_ROLE_KEY
// to the frontend; the frontend never talks to Supabase directly.

function authHeaders(env) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

function tableUrl(env, table) {
  return `${env.SUPABASE_URL}/rest/v1/${table}`;
}

function filterParams(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    params.set(key, `eq.${value}`);
  }
  return params;
}

export async function selectOne(env, table, filters) {
  const params = filterParams(filters);
  params.set("limit", "1");
  const res = await fetch(`${tableUrl(env, table)}?${params}`, { headers: authHeaders(env) });
  if (!res.ok) throw new Error(`Supabase select failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows[0] || null;
}

export async function selectMany(env, table, filters = {}, { order, limit } = {}) {
  const params = filterParams(filters);
  if (order) params.set("order", order);
  if (limit) params.set("limit", String(limit));
  const res = await fetch(`${tableUrl(env, table)}?${params}`, { headers: authHeaders(env) });
  if (!res.ok) throw new Error(`Supabase select failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function insertOne(env, table, data) {
  const res = await fetch(tableUrl(env, table), {
    method: "POST",
    headers: { ...authHeaders(env), Prefer: "return=representation" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Supabase insert failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows[0];
}

export async function updateOne(env, table, filters, data) {
  const params = filterParams(filters);
  const res = await fetch(`${tableUrl(env, table)}?${params}`, {
    method: "PATCH",
    headers: { ...authHeaders(env), Prefer: "return=representation" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Supabase update failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows[0];
}

export async function deleteOne(env, table, filters) {
  const params = filterParams(filters);
  const res = await fetch(`${tableUrl(env, table)}?${params}`, {
    method: "DELETE",
    headers: authHeaders(env),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Supabase delete failed: ${res.status} ${await res.text()}`);
  }
}
