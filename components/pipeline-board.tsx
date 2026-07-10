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
import { Badge } from "@/components/ui/badge";
import { ComposeEmailDialog } from "@/components/compose-email-dialog";

export interface BoardItem {
  applicationId: string;
  candidateId: string;
  fullName: string;
  email: string | null;
  score: number | null;
  source: string;
  stage: Stage;
}

function scoreVariant(score: number): "default" | "secondary" | "outline" {
  if (score >= 70) return "default";
  if (score >= 40) return "secondary";
  return "outline";
}

/** Presentational card (also used in the drag overlay). */
function Card({ item, dragging }: { item: BoardItem; dragging?: boolean }) {
  return (
    <div
      className={`rounded-lg border bg-card p-3 shadow-xs ${
        dragging ? "opacity-90 shadow-md" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/candidates/${item.candidateId}`}
          className="text-sm font-medium hover:underline"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {item.fullName}
        </Link>
        {item.score !== null ? (
          <Badge variant={scoreVariant(item.score)}>{item.score}</Badge>
        ) : (
          <Badge variant="outline">—</Badge>
        )}
      </div>
      <div className="text-muted-foreground mt-1 text-xs">{item.source}</div>
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
      {/* Drag handle = the card body */}
      <div
        {...listeners}
        {...attributes}
        className="cursor-grab touch-none active:cursor-grabbing"
      >
        <Card item={item} />
      </div>
      {/* Simple, reliable stage control (works alongside drag) */}
      <select
        aria-label="Change stage"
        data-testid={`stage-select-${item.applicationId}`}
        value={item.stage}
        onChange={(e) => onMove(item.applicationId, e.target.value as Stage)}
        className="border-input bg-background mt-1 w-full rounded-md border px-2 py-1 text-xs"
      >
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABELS[s]}
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
    <div className="flex w-52 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-medium">{STAGE_LABELS[stage]}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {items.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        data-testid={`col-${stage}`}
        className={`flex min-h-40 flex-1 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors ${
          isOver ? "border-primary bg-muted/50" : "bg-muted/20"
        }`}
      >
        {items.map((item) => (
          <DraggableCard key={item.applicationId} item={item} onMove={onMove} />
        ))}
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // Live updates via Supabase Realtime. Refetch on any change to this job.
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

  // Shared move logic for both drag-and-drop and the stage dropdown.
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
    // Wire the rejected stage to offer a rejection email (SPEC §7 Phase 3).
    if (toStage === "rejected") {
      setRejectPrompt({ ...current, stage: toStage });
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
