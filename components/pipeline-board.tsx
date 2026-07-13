"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Search,
  Columns3,
  List as ListIcon,
  Mail,
  CalendarClock,
  Eye,
  ChevronDown,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { moveApplicationStage } from "@/app/jobs/actions";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/constants";
import { StageBadge, STAGE_DOT } from "@/components/stage-badge";
import { ComposeEmailDialog } from "@/components/compose-email-dialog";
import { ScheduleInterviewDialog } from "@/components/schedule-interview-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface BoardItem {
  applicationId: string;
  candidateId: string;
  fullName: string;
  email: string | null;
  score: number | null;
  source: string;
  stage: Stage;
  jobId: string;
}

export interface JobOption {
  id: string;
  title: string;
  count: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
function scoreColor(score: number): string {
  if (score >= 85) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (score >= 70) return "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300";
  if (score >= 55) return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
}
function sourceLabel(source: string): string {
  return source === "linkedin" ? "LinkedIn" : "CV";
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null)
    return <span className="text-text-tertiary text-xs">—</span>;
  return (
    <span
      className={cn(
        "flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg px-1.5 text-xs font-bold tabular-nums",
        scoreColor(score),
      )}
    >
      {score}
    </span>
  );
}

function Card({ item, dragging }: { item: BoardItem; dragging?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 transition-all",
        dragging
          ? "rotate-2 scale-[1.03] opacity-95 shadow-lg"
          : "shadow-xs hover:border-border-strong hover:shadow-sm",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="avatar-gradient flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
          {initials(item.fullName)}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/candidates/${item.candidateId}`}
            className="block truncate text-sm font-medium hover:underline"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {item.fullName}
          </Link>
          <div className="text-text-secondary truncate text-xs">
            {item.email ?? "No email on file"}
          </div>
        </div>
        <ScoreBadge score={item.score} />
      </div>
      <div className="mt-2.5 flex items-center gap-1.5">
        <span className="bg-secondary text-text-secondary inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium">
          {sourceLabel(item.source)}
        </span>
      </div>
    </div>
  );
}

function QuickAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className="text-text-secondary hover:bg-brand-ghost hover:text-brand flex size-7 items-center justify-center rounded-md transition-colors"
    >
      {children}
    </button>
  );
}

function DraggableCard({
  item,
  onMove,
  onEmail,
  onSchedule,
}: {
  item: BoardItem;
  onMove: (applicationId: string, toStage: Stage) => void;
  onEmail: (item: BoardItem) => void;
  onSchedule: (item: BoardItem) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.applicationId,
    data: { stage: item.stage },
  });
  return (
    <div
      ref={setNodeRef}
      data-testid={`card-${item.applicationId}`}
      data-stage={item.stage}
      className={cn("group/card", isDragging && "opacity-40")}
    >
      <div
        {...listeners}
        {...attributes}
        className="cursor-grab touch-none rounded-lg active:cursor-grabbing"
      >
        <Card item={item} />
      </div>

      <div className="mt-1.5 flex items-center gap-1">
        <div className="flex gap-0.5 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100">
          <QuickAction label="Email" onClick={() => onEmail(item)}>
            <Mail className="size-4" />
          </QuickAction>
          <QuickAction label="Schedule interview" onClick={() => onSchedule(item)}>
            <CalendarClock className="size-4" />
          </QuickAction>
          <Link
            href={`/candidates/${item.candidateId}`}
            aria-label="View profile"
            title="View profile"
            onPointerDown={(e) => e.stopPropagation()}
            className="text-text-secondary hover:bg-brand-ghost hover:text-brand flex size-7 items-center justify-center rounded-md transition-colors"
          >
            <Eye className="size-4" />
          </Link>
        </div>

        <div className="relative ml-auto">
          <select
            aria-label="Move to stage"
            data-testid={`stage-select-${item.applicationId}`}
            value={item.stage}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => onMove(item.applicationId, e.target.value as Stage)}
            className="text-text-tertiary hover:text-text-primary cursor-pointer appearance-none rounded-md bg-transparent py-1 pr-5 pl-2 text-xs transition-colors"
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>
                Move to {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
          <ChevronDown className="text-text-tertiary pointer-events-none absolute right-1 top-1/2 size-3 -translate-y-1/2" />
        </div>
      </div>
    </div>
  );
}

function Column({
  stage,
  items,
  onMove,
  onEmail,
  onSchedule,
}: {
  stage: Stage;
  items: BoardItem[];
  onMove: (applicationId: string, toStage: Stage) => void;
  onEmail: (item: BoardItem) => void;
  onSchedule: (item: BoardItem) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div className="bg-surface-sunken flex h-full w-[300px] shrink-0 flex-col rounded-xl border">
      <div className="flex items-center gap-2 rounded-t-xl border-b px-3 py-2.5">
        <span className={cn("size-2 rounded-full", STAGE_DOT[stage])} />
        <span className="text-sm font-semibold">{STAGE_LABELS[stage]}</span>
        <span className="bg-card text-text-secondary ml-auto rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums">
          {items.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        data-testid={`col-${stage}`}
        className={cn(
          "flex flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors",
          isOver &&
            "outline-brand-light bg-brand-muted/40 -outline-offset-2 outline-2 outline-dashed",
        )}
      >
        {items.length === 0 ? (
          <div className="text-text-tertiary m-1 flex h-24 items-center justify-center rounded-lg border border-dashed text-center text-xs">
            No candidates here yet
          </div>
        ) : (
          items.map((item) => (
            <DraggableCard
              key={item.applicationId}
              item={item}
              onMove={onMove}
              onEmail={onEmail}
              onSchedule={onSchedule}
            />
          ))
        )}
      </div>
    </div>
  );
}

function RoleFilter({
  jobs,
  selected,
  onChange,
}: {
  jobs: JobOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const allSelected = selected.length === jobs.length;
  const label = allSelected
    ? "All Roles"
    : selected.length === 0
      ? "No roles"
      : selected.length === 1
        ? (jobs.find((j) => j.id === selected[0])?.title ?? "1 role")
        : `${selected.length} roles`;

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    );
  }
  function toggleAll() {
    onChange(allSelected ? [] : jobs.map((j) => j.id));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="border-input bg-card hover:border-border-strong focus-visible:border-ring focus-visible:ring-ring/25 flex h-9 cursor-pointer items-center gap-2 rounded-lg border py-1 pr-2.5 pl-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2"
      >
        <span className="max-w-[10rem] truncate">{label}</span>
        <ChevronDown className="text-text-tertiary size-4 shrink-0" />
      </button>

      {open ? (
        <div
          role="listbox"
          className="bg-card animate-in fade-in-0 zoom-in-95 absolute left-0 top-full z-20 mt-1.5 max-h-80 w-64 overflow-y-auto rounded-xl border p-1.5 shadow-lg"
        >
          <RoleOption
            label="All Roles"
            checked={allSelected}
            indeterminate={!allSelected && selected.length > 0}
            onToggle={toggleAll}
            emphasize
          />
          <div className="bg-border my-1 h-px" />
          {jobs.map((j) => (
            <RoleOption
              key={j.id}
              label={j.title}
              count={j.count}
              checked={selected.includes(j.id)}
              onToggle={() => toggle(j.id)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RoleOption({
  label,
  count,
  checked,
  indeterminate,
  onToggle,
  emphasize,
}: {
  label: string;
  count?: number;
  checked: boolean;
  indeterminate?: boolean;
  onToggle: () => void;
  emphasize?: boolean;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={checked}
      onClick={onToggle}
      className="hover:bg-brand-ghost flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors"
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
          checked || indeterminate
            ? "border-brand bg-brand text-white"
            : "border-border-strong bg-card",
        )}
      >
        {checked ? (
          <Check className="size-3" strokeWidth={3} />
        ) : indeterminate ? (
          <span className="bg-white h-0.5 w-2 rounded-full" />
        ) : null}
      </span>
      <span className={cn("min-w-0 flex-1 truncate", emphasize && "font-semibold")}>
        {label}
      </span>
      {typeof count === "number" ? (
        <span className="text-text-tertiary shrink-0 text-xs tabular-nums">{count}</span>
      ) : null}
    </button>
  );
}

function ListView({ items }: { items: BoardItem[] }) {
  const order = Object.fromEntries(STAGES.map((s, i) => [s, i])) as Record<Stage, number>;
  const sorted = [...items].sort((a, b) => {
    if (order[a.stage] !== order[b.stage]) return order[a.stage] - order[b.stage];
    return (b.score ?? -1) - (a.score ?? -1);
  });
  if (sorted.length === 0)
    return (
      <div className="text-text-tertiary surface p-10 text-center text-sm">
        No candidates match.
      </div>
    );
  return (
    <div className="surface divide-y overflow-hidden">
      {sorted.map((item) => (
        <Link
          key={item.applicationId}
          href={`/candidates/${item.candidateId}`}
          className="hover:bg-brand-ghost flex items-center gap-3 px-4 py-2.5 transition-colors"
        >
          <span className="avatar-gradient flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
            {initials(item.fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{item.fullName}</div>
            <div className="text-text-secondary truncate text-xs">
              {item.email ?? sourceLabel(item.source)}
            </div>
          </div>
          <StageBadge stage={item.stage} />
          <ScoreBadge score={item.score} />
        </Link>
      ))}
    </div>
  );
}

export function PipelineBoard({
  jobId,
  jobTitle,
  initialItems,
  jobs,
}: {
  jobId: string;
  jobTitle: string;
  initialItems: BoardItem[];
  jobs?: JobOption[];
}) {
  const multiRole = Boolean(jobs && jobs.length);
  const [items, setItems] = useState<BoardItem[]>(initialItems);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"board" | "list">("board");
  // Role filter (dashboard only): default to all roles selected.
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>(
    () => jobs?.map((j) => j.id) ?? [],
  );
  const [emailPrompt, setEmailPrompt] = useState<{
    item: BoardItem;
    rejection: boolean;
  } | null>(null);
  const [schedulePrompt, setSchedulePrompt] = useState<BoardItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    const supabase = createClient();
    const refetch = async () => {
      let q = supabase
        .from("applications")
        .select(
          "id, candidate_id, stage, score, job_id, candidates(full_name, source, email)",
        );
      // Dashboard shows all roles; the per-role board stays scoped to its job.
      if (!multiRole) q = q.eq("job_id", jobId);
      const { data } = await q;
      if (!data) return;
      setItems(
        (data as unknown as RealtimeRow[]).map((a) => ({
          applicationId: a.id,
          candidateId: a.candidate_id,
          fullName: a.candidates?.full_name ?? "Unknown candidate",
          email: a.candidates?.email ?? null,
          score: a.score,
          source: a.candidates?.source ?? "upload",
          stage: a.stage as Stage,
          jobId: a.job_id,
        })),
      );
    };
    const channel = supabase
      .channel(`board:${multiRole ? "all" : jobId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "applications",
          ...(multiRole ? {} : { filter: `job_id=eq.${jobId}` }),
        },
        refetch,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, multiRole]);

  async function moveItem(applicationId: string, toStage: Stage) {
    const current = items.find((i) => i.applicationId === applicationId);
    if (!current || current.stage === toStage) return;
    const fromStage = current.stage;

    setItems((prev) =>
      prev.map((i) =>
        i.applicationId === applicationId ? { ...i, stage: toStage } : i,
      ),
    );

    const res = await moveApplicationStage(applicationId, current.jobId, toStage);
    if (!res.ok) {
      toast.error(res.error);
      setItems((prev) =>
        prev.map((i) =>
          i.applicationId === applicationId ? { ...i, stage: fromStage } : i,
        ),
      );
      return;
    }

    toast.success(`${current.fullName} → ${STAGE_LABELS[toStage]}`);
    if (toStage === "rejected")
      setEmailPrompt({ item: { ...current, stage: toStage }, rejection: true });
    if (toStage === "interview_1" || toStage === "interview_2") {
      setSchedulePrompt({ ...current, stage: toStage });
    }
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    void moveItem(String(active.id), String(over.id) as Stage);
  }

  const activeItem = items.find((i) => i.applicationId === activeId) ?? null;
  const q = query.trim().toLowerCase();
  const shown = items
    .filter((i) => !multiRole || selectedJobIds.includes(i.jobId))
    .filter((i) => !q || i.fullName.toLowerCase().includes(q));

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {multiRole && jobs ? (
          <RoleFilter
            jobs={jobs}
            selected={selectedJobIds}
            onChange={setSelectedJobIds}
          />
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="text-text-tertiary pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name…"
              className="h-9 w-44 pl-8"
            />
          </div>
          <div className="bg-secondary flex items-center gap-0.5 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setView("board")}
              aria-label="Board view"
              aria-pressed={view === "board"}
              className={cn(
                "flex size-8 items-center justify-center rounded-md transition-colors",
                view === "board"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-text-secondary hover:text-foreground",
              )}
            >
              <Columns3 className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label="List view"
              aria-pressed={view === "list"}
              className={cn(
                "flex size-8 items-center justify-center rounded-md transition-colors",
                view === "list"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-text-secondary hover:text-foreground",
              )}
            >
              <ListIcon className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {view === "list" ? (
        <ListView items={shown} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="flex h-[calc(100svh-13rem)] gap-3 overflow-x-auto pb-2">
            {STAGES.map((stage) => (
              <Column
                key={stage}
                stage={stage}
                items={shown.filter((i) => i.stage === stage)}
                onMove={moveItem}
                onEmail={(it) => setEmailPrompt({ item: it, rejection: false })}
                onSchedule={(it) => setSchedulePrompt(it)}
              />
            ))}
          </div>
          <DragOverlay>
            {activeItem ? <Card item={activeItem} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {emailPrompt ? (
        <ComposeEmailDialog
          key={`email-${emailPrompt.item.applicationId}`}
          open
          onOpenChange={(o) => {
            if (!o) setEmailPrompt(null);
          }}
          applicationId={emailPrompt.item.applicationId}
          jobId={emailPrompt.item.jobId}
          candidateName={emailPrompt.item.fullName}
          candidateEmail={emailPrompt.item.email}
          jobTitle={
            jobs?.find((j) => j.id === emailPrompt.item.jobId)?.title ?? jobTitle
          }
          defaultTemplate={emailPrompt.rejection ? "rejection" : "outreach"}
        />
      ) : null}

      {schedulePrompt ? (
        <ScheduleInterviewDialog
          key={`sched-${schedulePrompt.applicationId}`}
          open
          onOpenChange={(o) => {
            if (!o) setSchedulePrompt(null);
          }}
          applicationId={schedulePrompt.applicationId}
          jobId={schedulePrompt.jobId}
          candidateName={schedulePrompt.fullName}
        />
      ) : null}
    </div>
  );
}

interface RealtimeRow {
  id: string;
  candidate_id: string;
  stage: string;
  score: number | null;
  job_id: string;
  candidates: { full_name: string; source: string; email: string | null } | null;
}
