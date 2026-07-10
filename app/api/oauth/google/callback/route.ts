import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, saveGoogleConnection } from "@/lib/google";

/** Google OAuth redirect target: verify state, exchange code, store tokens. */
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const settings = `${origin}/settings/integrations`;

  const err = searchParams.get("error");
  if (err) return NextResponse.redirect(`${settings}?error=${encodeURIComponent(err)}`);

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${settings}?error=state`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // Without a refresh token we can't send later. Force reconsent.
      return NextResponse.redirect(`${settings}?error=no_refresh_token`);
    }
    await saveGoogleConnection(supabase, tokens);
  } catch {
    return NextResponse.redirect(`${settings}?error=exchange_failed`);
  }

  const res = NextResponse.redirect(`${settings}?connected=google`);
  res.cookies.delete("google_oauth_state");
  return res;
}
