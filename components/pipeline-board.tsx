"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
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

function DraggableCard({ item }: { item: BoardItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.applicationId,
    data: { stage: item.stage },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab touch-none active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
      data-testid={`card-${item.applicationId}`}
      data-stage={item.stage}
    >
      <Card item={item} />
    </div>
  );
}

function Column({
  stage,
  items,
}: {
  stage: Stage;
  items: BoardItem[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div className="flex w-64 shrink-0 flex-col">
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
          <DraggableCard key={item.applicationId} item={item} />
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
  // When a candidate is dropped into "rejected", prompt to send the rejection email.
  const [rejectPrompt, setRejectPrompt] = useState<BoardItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // Live updates via Supabase Realtime (SPEC §7 Phase 2). Refetch on any change.
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

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const applicationId = String(active.id);
    const toStage = String(over.id) as Stage;
    const current = items.find((i) => i.applicationId === applicationId);
    if (!current || current.stage === toStage) return;

    const fromStage = current.stage;
    // Optimistic move.
    setItems((prev) =>
      prev.map((i) =>
        i.applicationId === applicationId ? { ...i, stage: toStage } : i,
      ),
    );

    const res = await moveApplicationStage(applicationId, jobId, toStage);
    if (!res.ok) {
      toast.error(res.error);
      // Revert.
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

  const activeItem = items.find((i) => i.applicationId === activeId) ?? null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <Column
            key={stage}
            stage={stage}
            items={items.filter((i) => i.stage === stage)}
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
