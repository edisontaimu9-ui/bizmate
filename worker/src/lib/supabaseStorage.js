// Supabase Storage over REST — the browser uploads file bytes directly to
// Supabase using a signed URL the Worker generates; the Worker itself never
// handles raw file data. Verified against Supabase's actual Storage REST
// API: POST .../object/upload/sign/{bucket}/{path} returns { url }, which
// the client then PUTs the file to.
//
// The Worker always signs with the service_role key, and — critically —
// always builds `path` itself from the caller's server-resolved businessId
// (see routes/uploads.js). The client supplies a filename, never a path.
const BUCKET = "bizmate";

function authHeaders(env) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function createSignedUploadUrl(env, path) {
  const res = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${path}`,
    {
      method: "POST",
      headers: { ...authHeaders(env), "x-upsert": "true" },
      body: JSON.stringify({}),
    }
  );
  if (!res.ok) throw new Error(`Storage sign failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  // data.url is relative, e.g. "/object/upload/sign/bizmate/products/.../file.jpg?token=..."
  return `${env.SUPABASE_URL}/storage/v1${data.url}`;
}

// Bucket is public, so this needs no signing — anyone with the URL can view
// the file, which is what you want for product photos and business
// documents shown to customers.
export function buildPublicUrl(env, path) {
  return `${env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

export async function deleteObject(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "DELETE",
    headers: authHeaders(env),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Storage delete failed: ${res.status} ${await res.text()}`);
  }
}
