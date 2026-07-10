import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

export function AppHeader({ email }: { email?: string | null }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-semibold">
            HR Recruiting Assistant
          </Link>
          <Link
            href="/settings/integrations"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Settings
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {email ? (
            <span className="text-muted-foreground hidden text-sm sm:inline">
              {email}
            </span>
          ) : null}
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
