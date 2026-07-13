import { redirect } from "next/navigation";
import { Check, LogOut, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getGoogleConnection, isGoogleConfigured } from "@/lib/google";
import { isZohoConfigured, zohoSenderAddress } from "@/lib/zoho";
import { signOut } from "@/app/auth/actions";
import { AppShell } from "@/components/app-shell";
import { GmailIcon, ZohoMailIcon } from "@/components/brand-icons";
import { ProfilePhotoForm } from "@/components/profile-photo-form";
import { DisconnectGoogleButton } from "@/components/disconnect-google-button";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata = {
  title: "Settings · Mujtaba Hires",
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
  const zohoConfigured = isZohoConfigured();
  const zohoSender = zohoSenderAddress();

  return (
    <AppShell email={user.email} avatarUrl={(user.user_metadata?.avatar_url as string | undefined) ?? null}>
      <div className="page-enter mx-auto w-full max-w-2xl px-5 py-7 md:px-6 md:py-9">
        <div className="mb-7">
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
            Settings
          </h1>
          <p className="text-text-secondary mt-1 text-sm">
            Connect services and manage your account.
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

        {/* Connected services */}
        <h2 className="text-text-tertiary mb-2 text-xs font-semibold uppercase tracking-wider">
          Connected services
        </h2>

        {/* Zoho Mail — candidate email sending */}
        <div className="surface mb-3 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <ZohoMailIcon className="size-11" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Zoho Mail</h3>
              {zohoConfigured ? (
                <span className="inline-flex h-6 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <Check className="size-3" /> Connected
                </span>
              ) : (
                <span className="border-border text-text-secondary inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium">
                  Not configured
                </span>
              )}
            </div>
            <p className="text-text-secondary mt-0.5 text-sm">
              {zohoConfigured
                ? `Sending candidate email from ${zohoSender ?? "your Zoho mailbox"}`
                : "Send candidate email from your Zoho mailbox over SMTP."}
            </p>
          </div>
          {!zohoConfigured ? (
            <p className="text-text-tertiary shrink-0 text-xs sm:max-w-[13rem]">
              Server not configured. Set <code>ZOHO_SMTP_USER</code> and{" "}
              <code>ZOHO_SMTP_PASSWORD</code> (a Zoho app-specific password).
            </p>
          ) : null}
        </div>

        {/* Google — interview scheduling (Calendar + Meet) */}
        <div className="surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <GmailIcon className="size-11" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Google</h3>
              {google ? (
                <span className="inline-flex h-6 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <Check className="size-3" /> Connected
                </span>
              ) : (
                <span className="border-border text-text-secondary inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium">
                  Not connected
                </span>
              )}
            </div>
            <p className="text-text-secondary mt-0.5 text-sm">
              {google
                ? `Scheduling interviews as ${google.email ?? "your account"}`
                : "Schedule Google Meet interviews on your calendar."}
            </p>
          </div>
          <div className="shrink-0">
            {!configured ? (
              <p className="text-text-tertiary text-xs">
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
          </div>
        </div>

        {/* Account */}
        <h2 className="text-text-tertiary mb-2 mt-8 text-xs font-semibold uppercase tracking-wider">
          Account
        </h2>
        <div className="surface flex flex-col gap-5 p-5">
          <ProfilePhotoForm
            currentUrl={
              (user.user_metadata?.avatar_url as string | undefined) ?? null
            }
            email={user.email}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div className="min-w-0">
              <h3 className="truncate font-semibold">{user.email}</h3>
              <p className="text-text-secondary text-sm">Signed in</p>
            </div>
            <form action={signOut} className="shrink-0">
              <Button type="submit" variant="outline" className="gap-2">
                <LogOut className="size-4" /> Sign out
              </Button>
            </form>
          </div>
        </div>

        {/* Danger zone */}
        <div className="mt-8">
          <Accordion multiple={false}>
            <AccordionItem
              value="danger"
              className="rounded-xl border border-red-200 dark:border-red-900/60"
            >
              <AccordionTrigger className="text-danger px-4 text-sm font-semibold">
                <span className="flex items-center gap-2">
                  <ShieldAlert className="size-4" /> Danger zone
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <p className="text-text-secondary text-sm">
                  Permanently deleting your account and all candidate data can&apos;t
                  be undone. For safety this is handled by your administrator against
                  the database — contact them to request a full wipe or data export.
                </p>
                <Button
                  variant="destructive"
                  className="mt-3"
                  disabled
                  title="Contact your administrator"
                >
                  Delete account &amp; data
                </Button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </AppShell>
  );
}
