// Creates (or confirms) the single owner account using the Supabase Admin API.
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the env.
//
// Usage:
//   node --env-file=.env.local scripts/create-owner.mjs owner@example.com 'a-strong-password'

import { createClient } from "@supabase/supabase-js";

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error(
    "Usage: node --env-file=.env.local scripts/create-owner.mjs <email> <password>",
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (error) {
  console.error("Failed to create owner:", error.message);
  process.exit(1);
}

console.log(`Owner created and confirmed: ${data.user?.email} (${data.user?.id})`);
console.log(
  "Reminder: disable public sign-ups in Supabase (Authentication -> Sign In / Providers).",
);
