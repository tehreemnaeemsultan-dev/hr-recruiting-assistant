"use client";

import { useEffect, useState } from "react";
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
import { createClient } from "@/lib/supabase/client";
import { moveApplicationStage } from "@/app/jobs/actions";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/constants";
import { ComposeEmailDialog } from "@/components/compose-email-dialog";
import { ScheduleInterviewDialog } from "@/components/schedule-interview-dialog";

export interface BoardItem {
  applicationId: string;
  candidateId: string;
  fullName: string;
  email: string | null;
  score: number | null;
  source: string;
  stage: Stage;
}

const STAGE_DOT: Record<Stage, string> = {
  new: "bg-slate-400",
  screening: "bg-sky-500",
  interview_1: "bg-blue-500",
  interview_2: "bg-indigo-500",
  hired: "bg-emerald-500",
  rejected: "bg-rose-500",
};

// Top-accent color for each column header.
const STAGE_BORDER: Record<Stage, string> = {
  new: "border-t-slate-400",
  screening: "border-t-sky-500",
  interview_1: "border-t-blue-500",
  interview_2: "border-t-indigo-500",
  hired: "border-t-emerald-500",
  rejected: "border-t-rose-500",
};

const AVATAR_COLORS = [
  "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?"
  );
}
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function scoreChip(score: number): string {
  if (score >= 70) return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300";
  if (score >= 40) return "bg-amber-500/15 text-amber-600 dark:text-amber-300";
  return "bg-rose-500/15 text-rose-600 dark:text-rose-300";
}
function sourceLabel(source: string): string {
  return source === "linkedin" ? "LinkedIn" : "Uploaded CV";
}

function Card({ item, dragging }: { item: BoardItem; dragging?: boolean }) {
  return (
    <div
      className={`bg-card rounded-xl border p-3 transition-all ${
        dragging
          ? "shadow-xl ring-primary/30 rotate-1 ring-2"
          : "shadow-xs hover:-translate-y-0.5 hover:shadow-md"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${avatarColor(
            item.fullName,
          )}`}
        >
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
          <div className="text-muted-foreground truncate text-xs">
            {sourceLabel(item.source)}
          </div>
        </div>
        {item.score !== null ? (
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${scoreChip(
              item.score,
            )}`}
          >
            {item.score}
          </span>
        ) : (
          <span className="text-muted-foreground/60 text-xs">—</span>
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  item,
  onMove,
}: {
  item: BoardItem;
  onMove: (applicationId: string, toStage: Stage) => void;
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
      className={isDragging ? "opacity-40" : ""}
    >
      <div
        {...listeners}
        {...attributes}
        className="cursor-grab touch-none active:cursor-grabbing"
      >
        <Card item={item} />
      </div>
      <select
        aria-label="Move to stage"
        data-testid={`stage-select-${item.applicationId}`}
        value={item.stage}
        onChange={(e) => onMove(item.applicationId, e.target.value as Stage)}
        className="text-muted-foreground hover:text-foreground mt-1.5 w-full cursor-pointer rounded-md border bg-transparent px-2 py-1 text-xs transition-colors"
      >
        {STAGES.map((s) => (
          <option key={s} value={s}>
            Move to {STAGE_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}

function Column({
  stage,
  items,
  onMove,
}: {
  stage: Stage;
  items: BoardItem[];
  onMove: (applicationId: string, toStage: Stage) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div className="flex w-[16rem] shrink-0 flex-col">
      <div
        className={`mb-2 flex items-center gap-2 rounded-xl border border-t-[3px] bg-card px-3 py-2.5 ${STAGE_BORDER[stage]}`}
      >
        <span className={`size-2 rounded-full ${STAGE_DOT[stage]}`} />
        <span className="text-sm font-semibold">{STAGE_LABELS[stage]}</span>
        <span className="bg-muted text-muted-foreground ml-auto rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
          {items.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        data-testid={`col-${stage}`}
        className={`flex min-h-40 flex-1 flex-col gap-2 rounded-2xl border p-2 transition-colors ${
          isOver
            ? "border-primary/50 bg-primary/5"
            : "bg-muted/30 border-transparent"
        }`}
      >
        {items.length === 0 ? (
          <div className="text-muted-foreground/60 flex h-24 items-center justify-center text-xs">
            Drop here
          </div>
        ) : (
          items.map((item) => (
            <DraggableCard key={item.applicationId} item={item} onMove={onMove} />
          ))
        )}
      </div>
    </div>
  );
}

export function PipelineBoard({
  jobId,
  jobTitle,
  initialItems,
}: {
  jobId: string;
  jobTitle: string;
  initialItems: BoardItem[];
}) {
  const [items, setItems] = useState<BoardItem[]>(initialItems);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rejectPrompt, setRejectPrompt] = useState<BoardItem | null>(null);
  const [interviewPrompt, setInterviewPrompt] = useState<BoardItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`board:${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "applications",
          filter: `job_id=eq.${jobId}`,
        },
        async () => {
          const { data } = await supabase
            .from("applications")
            .select(
              "id, candidate_id, stage, score, candidates(full_name, source, email)",
            )
            .eq("job_id", jobId);
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
            })),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  async function moveItem(applicationId: string, toStage: Stage) {
    const current = items.find((i) => i.applicationId === applicationId);
    if (!current || current.stage === toStage) return;
    const fromStage = current.stage;

    setItems((prev) =>
      prev.map((i) =>
        i.applicationId === applicationId ? { ...i, stage: toStage } : i,
      ),
    );

    const res = await moveApplicationStage(applicationId, jobId, toStage);
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
    if (toStage === "rejected") setRejectPrompt({ ...current, stage: toStage });
    if (toStage === "interview_1" || toStage === "interview_2") {
      setInterviewPrompt({ ...current, stage: toStage });
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <Column
            key={stage}
            stage={stage}
            items={items.filter((i) => i.stage === stage)}
            onMove={moveItem}
          />
        ))}
      </div>
      <DragOverlay>
        {activeItem ? <Card item={activeItem} dragging /> : null}
      </DragOverlay>

      {rejectPrompt ? (
        <ComposeEmailDialog
          key={rejectPrompt.applicationId}
          open
          onOpenChange={(o) => {
            if (!o) setRejectPrompt(null);
          }}
          applicationId={rejectPrompt.applicationId}
          jobId={jobId}
          candidateName={rejectPrompt.fullName}
          candidateEmail={rejectPrompt.email}
          jobTitle={jobTitle}
          defaultTemplate="rejection"
        />
      ) : null}

      {interviewPrompt ? (
        <ScheduleInterviewDialog
          key={interviewPrompt.applicationId}
          open
          onOpenChange={(o) => {
            if (!o) setInterviewPrompt(null);
          }}
          applicationId={interviewPrompt.applicationId}
          jobId={jobId}
          candidateName={interviewPrompt.fullName}
        />
      ) : null}
    </DndContext>
  );
}

interface RealtimeRow {
  id: string;
  candidate_id: string;
  stage: string;
  score: number | null;
  candidates: { full_name: string; source: string; email: string | null } | null;
}
