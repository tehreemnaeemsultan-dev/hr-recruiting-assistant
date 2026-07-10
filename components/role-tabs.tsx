import Link from "next/link";

export function RoleTabs({
  jobId,
  active,
}: {
  jobId: string;
  active: "people" | "board";
}) {
  const item = (href: string, label: string, isActive: boolean) => (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        isActive
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="bg-muted/60 inline-flex rounded-lg border p-1">
      {item(`/jobs/${jobId}`, "People", active === "people")}
      {item(`/jobs/${jobId}/board`, "Board", active === "board")}
    </div>
  );
}
