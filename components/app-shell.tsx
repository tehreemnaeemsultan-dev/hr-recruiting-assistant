"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Search, BarChart3, Settings, Plus, LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/", label: "Home", icon: LayoutGrid, match: (p: string) =>
      p === "/" || p.startsWith("/jobs") || p.startsWith("/candidates") },
  { href: "/source", label: "Find people", icon: Search, match: (p: string) => p.startsWith("/source") },
  { href: "/analytics", label: "Analytics", icon: BarChart3, match: (p: string) => p.startsWith("/analytics") },
  { href: "/settings/integrations", label: "Settings", icon: Settings, match: (p: string) => p.startsWith("/settings") },
];

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#3a5ce8] to-[#1e40c4] text-sm font-bold text-white shadow-sm">
        MH
      </span>
      <span className="text-[15px] font-semibold tracking-tight">
        Mujtaba Hires
      </span>
    </Link>
  );
}

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            }`}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  email,
  children,
}: {
  email?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-svh">
      {/* Desktop sidebar */}
      <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r p-4 md:flex">
        <div className="px-1 py-2">
          <Brand />
        </div>

        <div className="mt-4">
          <Button
            render={<Link href="/jobs/new" />} nativeButton={false}
            className="w-full justify-start gap-2"
          >
            <Plus className="size-4" />
            New role
          </Button>
        </div>

        <div className="mt-6">
          <NavLinks pathname={pathname} />
        </div>

        <div className="flex-1" />

        <div className="border-sidebar-border flex items-center justify-between gap-2 border-t pt-3">
          <div className="min-w-0">
            <div className="text-muted-foreground truncate text-xs">
              {email ?? "Signed in"}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <form action={signOut}>
              <Button
                type="submit"
                variant="ghost"
                size="icon-sm"
                aria-label="Sign out"
              >
                <LogOut />
              </Button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 flex items-center justify-between gap-2 border-b px-4 py-3 backdrop-blur md:hidden">
          <Brand />
          <div className="flex items-center gap-1">
            <Button render={<Link href="/jobs/new" />} nativeButton={false} size="sm" className="gap-1">
              <Plus className="size-4" /> New
            </Button>
            <ThemeToggle />
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="icon-sm" aria-label="Sign out">
                <LogOut />
              </Button>
            </form>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
