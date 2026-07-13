"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Columns3,
  LayoutDashboard,
  Search,
  BarChart3,
  Mail,
  Settings,
  Plus,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (p: string) => boolean;
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Menu",
    items: [
      {
        href: "/",
        label: "Board",
        icon: Columns3,
        match: (p) =>
          p === "/" || p.startsWith("/jobs") || p.startsWith("/candidates"),
      },
      {
        href: "/overview",
        label: "Overview",
        icon: LayoutDashboard,
        match: (p) => p.startsWith("/overview"),
      },
      {
        href: "/analytics",
        label: "Analytics",
        icon: BarChart3,
        match: (p) => p.startsWith("/analytics"),
      },
    ],
  },
  {
    title: "Recruiting",
    items: [
      {
        href: "/source",
        label: "Find people",
        icon: Search,
        match: (p) => p.startsWith("/source"),
      },
      {
        href: "/emails",
        label: "Emails",
        icon: Mail,
        match: (p) => p.startsWith("/emails"),
      },
    ],
  },
  {
    title: "Workspace",
    items: [
      {
        href: "/settings/integrations",
        label: "Settings",
        icon: Settings,
        match: (p) => p.startsWith("/settings"),
      },
    ],
  },
];

function Brand({
  onNavigate,
  avatarUrl,
}: {
  onNavigate?: () => void;
  avatarUrl?: string | null;
}) {
  return (
    <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className="ring-border size-9 rounded-xl object-cover shadow-sm ring-1"
        />
      ) : (
        <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5b6ff0] to-[#3a5ce8] text-[13px] font-bold text-white shadow-sm">
          MH
        </span>
      )}
      <span className="text-[15px] font-semibold tracking-tight">
        Mujtaba Hires
      </span>
    </Link>
  );
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-5">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="text-text-tertiary mb-1 mt-4 px-3 text-xs font-semibold uppercase tracking-wider first:mt-0">
            {section.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = item.match(pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-brand-muted text-brand"
                      : "text-text-secondary hover:bg-brand-ghost hover:text-text-primary",
                  )}
                >
                  {active ? (
                    <span className="bg-brand absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full" />
                  ) : null}
                  <Icon
                    className={cn(
                      "size-[18px] transition-colors",
                      active
                        ? "text-brand"
                        : "text-text-tertiary group-hover:text-text-primary",
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function initials(email?: string | null) {
  if (!email) return "MH";
  const name = email.split("@")[0];
  const parts = name.split(/[._-]+/).filter(Boolean);
  return (
    ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() ||
    name.slice(0, 2).toUpperCase()
  );
}

function SidebarBody({
  pathname,
  email,
  avatarUrl,
  onNavigate,
}: {
  pathname: string;
  email?: string | null;
  avatarUrl?: string | null;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-1 py-2">
        <Brand onNavigate={onNavigate} avatarUrl={avatarUrl} />
      </div>

      <div className="mt-5">
        <Button
          render={<Link href="/jobs/new" />}
          nativeButton={false}
          onClick={onNavigate}
          className="h-10 w-full justify-center gap-2 rounded-xl"
        >
          <Plus className="size-4" />
          New role
        </Button>
      </div>

      <div className="mt-7 flex-1 overflow-y-auto">
        <NavLinks pathname={pathname} onNavigate={onNavigate} />
      </div>

      <div className="border-sidebar-border mt-4 flex items-center gap-2.5 border-t pt-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="ring-border size-9 shrink-0 rounded-full object-cover ring-1"
          />
        ) : (
          <span className="avatar-gradient flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
            {initials(email)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium capitalize">
            {email?.split("@")[0] ?? "Account"}
          </div>
          <div className="text-muted-foreground truncate text-xs">
            {email ?? "Signed in"}
          </div>
        </div>
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
  );
}

export function AppShell({
  email,
  avatarUrl,
  children,
}: {
  email?: string | null;
  avatarUrl?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-svh">
      {/* Desktop sidebar */}
      <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r p-4 md:flex">
        <SidebarBody pathname={pathname} email={email} avatarUrl={avatarUrl} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="animate-in fade-in absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="bg-sidebar text-sidebar-foreground animate-in slide-in-from-left absolute inset-y-0 left-0 flex w-72 flex-col border-r p-4 shadow-2xl duration-300">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="hover:bg-sidebar-accent absolute top-4 right-4 flex size-8 items-center justify-center rounded-lg"
            >
              <X className="size-4" />
            </button>
            <SidebarBody
              pathname={pathname}
              email={email}
              avatarUrl={avatarUrl}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top header */}
        <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="hover:bg-muted flex size-9 items-center justify-center rounded-lg md:hidden"
            >
              <Menu className="size-5" />
            </button>
            <div className="md:hidden">
              <Brand />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              render={<Link href="/jobs/new" />}
              nativeButton={false}
              size="sm"
              className="hidden gap-1.5 rounded-lg sm:inline-flex"
            >
              <Plus className="size-4" /> New role
            </Button>
            <ThemeToggle />
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="ring-border ml-1 hidden size-9 rounded-full object-cover ring-1 md:block"
              />
            ) : (
              <span className="avatar-gradient ml-1 hidden size-9 items-center justify-center rounded-full text-xs font-semibold md:flex">
                {initials(email)}
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
