import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/crypto";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

// One OAuth app covers Phase 3 (Gmail send) and Phase 4 (Calendar events).
export const GOOGLE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
];

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
  scope?: string;
  token_type?: string;
}

function requireGoogleEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google OAuth is not configured (GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI).",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI &&
      process.env.TOKEN_ENCRYPTION_KEY,
  );
}

export function buildGoogleAuthUrl(state: string): string {
  const { clientId, redirectUri } = requireGoogleEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // force a refresh_token every connect
    include_granted_scopes: "true",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret, redirectUri } = requireGoogleEnv();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  return res.json();
}

async function refreshAccessToken(
  refreshToken: string,
): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = requireGoogleEnv();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  return res.json();
}

function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1], "base64").toString("utf8"),
    );
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

async function fetchUserEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json.email === "string" ? json.email : null;
  } catch {
    return null;
  }
}

/** Persist tokens after a successful authorization-code exchange. */
export async function saveGoogleConnection(
  supabase: SupabaseServer,
  tokens: GoogleTokenResponse,
): Promise<void> {
  const email =
    emailFromIdToken(tokens.id_token) ??
    (await fetchUserEmail(tokens.access_token));
  const expiresAt = new Date(
    Date.now() + (tokens.expires_in ?? 3600) * 1000,
  ).toISOString();

  await supabase.from("integration_tokens").upsert(
    {
      provider: "google",
      access_token_enc: encrypt(tokens.access_token),
      refresh_token_enc: tokens.refresh_token
        ? encrypt(tokens.refresh_token)
        : null,
      scope: tokens.scope ?? GOOGLE_SCOPES.join(" "),
      expires_at: expiresAt,
      account_id: email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider" },
  );
}

export interface GoogleConnection {
  email: string | null;
  scope: string | null;
  updatedAt: string | null;
}

export async function getGoogleConnection(
  supabase: SupabaseServer,
): Promise<GoogleConnection | null> {
  const { data } = await supabase
    .from("integration_tokens")
    .select("account_id, scope, updated_at")
    .eq("provider", "google")
    .maybeSingle();
  if (!data) return null;
  return {
    email: data.account_id,
    scope: data.scope,
    updatedAt: data.updated_at,
  };
}

/** Returns a valid access token, refreshing (and persisting) if near expiry. */
async function getValidAccessToken(supabase: SupabaseServer): Promise<string> {
  const { data: row } = await supabase
    .from("integration_tokens")
    .select("access_token_enc, refresh_token_enc, expires_at")
    .eq("provider", "google")
    .maybeSingle();
  if (!row || !row.access_token_enc) {
    throw new Error("Google is not connected. Connect it in Settings.");
  }

  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (Date.now() < expiresAt - 60_000) {
    return decrypt(row.access_token_enc);
  }

  if (!row.refresh_token_enc) {
    throw new Error("Google session expired. Reconnect Google in Settings.");
  }
  const refreshed = await refreshAccessToken(decrypt(row.refresh_token_enc));
  const newExpiresAt = new Date(
    Date.now() + (refreshed.expires_in ?? 3600) * 1000,
  ).toISOString();
  await supabase
    .from("integration_tokens")
    .update({
      access_token_enc: encrypt(refreshed.access_token),
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
      // Google does not return a new refresh_token on refresh — keep the stored one.
      ...(refreshed.refresh_token
        ? { refresh_token_enc: encrypt(refreshed.refresh_token) }
        : {}),
    })
    .eq("provider", "google");
  return refreshed.access_token;
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function encodeHeader(value: string): string {
  // RFC 2047 encode non-ASCII header values (e.g. names in the subject).
  return /^[\x00-\x7F]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** Send an HTML email from the connected Google account via the Gmail API. */
export async function sendGmail(
  supabase: SupabaseServer,
  msg: { to: string; subject: string; html: string },
): Promise<{ id: string }> {
  const { data: row } = await supabase
    .from("integration_tokens")
    .select("account_id")
    .eq("provider", "google")
    .maybeSingle();
  const from = row?.account_id ?? "me";

  const accessToken = await getValidAccessToken(supabase);

  const mime = [
    `From: ${from}`,
    `To: ${msg.to}`,
    `Subject: ${encodeHeader(msg.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    msg.html,
  ].join("\r\n");

  const res = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: base64url(mime) }),
  });
  if (!res.ok) throw new Error(`Gmail send failed: ${await res.text()}`);
  const json = await res.json();
  return { id: json.id as string };
}
