import "server-only";
import { createClient } from "@supabase/supabase-js";
import { RESUMES_BUCKET_NAME } from "@/lib/constants";

/**
 * Service-role Supabase client. Bypasses RLS — use ONLY in server code for
 * trusted admin tasks (Storage signed URLs, downloads for parsing, cascade
 * deletes). Never import this into a Client Component.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (server-only).",
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const RESUMES_BUCKET = RESUMES_BUCKET_NAME;
