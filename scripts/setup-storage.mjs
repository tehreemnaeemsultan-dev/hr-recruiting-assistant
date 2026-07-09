// Creates the private "resumes" Storage bucket used for uploaded CVs.
// Idempotent. Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
//
// Usage: node --env-file=.env.local scripts/setup-storage.mjs

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = "resumes";

const { data: existing } = await admin.storage.getBucket(BUCKET);
if (existing) {
  console.log(`Bucket "${BUCKET}" already exists (private=${!existing.public}).`);
  process.exit(0);
}

const { error } = await admin.storage.createBucket(BUCKET, {
  public: false,
  allowedMimeTypes: ["application/pdf"],
  fileSizeLimit: "15MB",
});

if (error) {
  console.error("Failed to create bucket:", error.message);
  process.exit(1);
}

console.log(`Created private bucket "${BUCKET}" (PDF only, 15MB limit).`);
