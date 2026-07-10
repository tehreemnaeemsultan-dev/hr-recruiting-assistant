import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildGoogleAuthUrl, isGoogleConfigured } from "@/lib/google";

/** Begin the Google OAuth flow: set a CSRF state cookie and redirect to Google. */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(
      `${origin}/settings/integrations?error=not_configured`,
    );
  }

  const state = crypto.randomUUID();
  const authUrl = buildGoogleAuthUrl(state);

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
