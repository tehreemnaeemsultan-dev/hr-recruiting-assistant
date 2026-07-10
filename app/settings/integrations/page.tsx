import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getGoogleConnection, isGoogleConfigured } from "@/lib/google";
import { AppShell } from "@/components/app-shell";
import { DisconnectGoogleButton } from "@/components/disconnect-google-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata = {
  title: "Integrations · HR Recruiting Assistant",
};

const ERROR_MESSAGES: Record<string, string> = {
  not_configured:
    "Google OAuth isn't configured on the server (missing client id/secret).",
  state: "Sign-in state mismatch. Please try connecting again.",
  no_refresh_token:
    "Google didn't return a refresh token. Try again and approve all permissions.",
  exchange_failed: "Could not complete Google authorization. Please try again.",
  access_denied: "You declined the Google permissions.",
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const configured = isGoogleConfigured();
  const google = configured ? await getGoogleConnection(supabase) : null;

  return (
    <AppShell email={user.email}>
      <div className="mx-auto w-full max-w-2xl px-6 py-8 md:py-10">
        <div className="mb-6">
          <Link href="/" className="text-muted-foreground text-sm hover:underline">
            ← Home
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Integrations
          </h1>
          <p className="text-muted-foreground text-sm">
            Connect Google to send emails and schedule interviews.
          </p>
        </div>

        {connected === "google" ? (
          <Alert className="mb-4">
            <AlertDescription>Google connected successfully.</AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {ERROR_MESSAGES[error] ?? `Something went wrong (${error}).`}
            </AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Google (Gmail + Calendar)</CardTitle>
                <CardDescription>
                  {google
                    ? `Connected as ${google.email ?? "your account"}`
                    : "Send email from your Gmail and schedule Google Meet interviews."}
                </CardDescription>
              </div>
              {google ? (
                <Badge variant="secondary">Connected</Badge>
              ) : (
                <Badge variant="outline">Not connected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!configured ? (
              <p className="text-muted-foreground text-sm">
                Server not configured. Set <code>GOOGLE_CLIENT_ID</code>,{" "}
                <code>GOOGLE_CLIENT_SECRET</code>, <code>GOOGLE_REDIRECT_URI</code>{" "}
                and <code>TOKEN_ENCRYPTION_KEY</code>.
              </p>
            ) : google ? (
              <DisconnectGoogleButton />
            ) : (
              <Button render={<a href="/api/oauth/google/start" />} nativeButton={false}>
                Connect Google
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
