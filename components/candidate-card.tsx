"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { rescoreApplication, deleteCandidate } from "@/app/jobs/actions";
import type { ScoreBreakdown } from "@/lib/types";

export interface CandidateCardData {
  applicationId: string;
  candidateId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  sourceFilename: string | null;
  score: number | null;
  scoreSummary: string | null;
  breakdown: ScoreBreakdown | null;
  rank: number;
}

function scoreCircle(score: number): string {
  if (score >= 70)
    return "bg-emerald-500/15 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300";
  if (score >= 40)
    return "bg-amber-500/15 text-amber-600 ring-amber-500/25 dark:text-amber-300";
  return "bg-rose-500/15 text-rose-600 ring-rose-500/25 dark:text-rose-300";
}

function recommendationVariant(
  rec: string,
): "default" | "secondary" | "outline" {
  if (rec === "strong") return "default";
  if (rec === "possible") return "secondary";
  return "outline";
}

export function CandidateCard({
  data,
  jobId,
}: {
  data: CandidateCardData;
  jobId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  function onRescore() {
    startTransition(async () => {
      const res = await rescoreApplication(data.applicationId, jobId);
      if (!res.ok) toast.error(res.error);
      else if (res.errors) toast.error("Scoring failed — see the summary.");
      else toast.success(`${data.fullName} re-scored.`);
      router.refresh();
    });
  }

  function onDelete() {
    if (!confirm(`Remove ${data.fullName} and delete their CV? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    startTransition(async () => {
      const res = await deleteCandidate(data.candidateId, jobId);
      if (!res.ok) {
        toast.error(res.error);
        setDeleting(false);
      } else {
        toast.success(`${data.fullName} removed.`);
        router.refresh();
      }
    });
  }

  const b = data.breakdown;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground w-6 text-sm tabular-nums">
              {data.rank}.
            </span>
            <div>
              <Link
                href={`/candidates/${data.candidateId}`}
                className="font-medium hover:underline"
              >
                {data.fullName}
              </Link>
              <div className="text-muted-foreground text-xs">
                {[data.email, data.phone].filter(Boolean).join(" · ") ||
                  data.sourceFilename ||
                  "Uploaded CV"}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {b ? (
              <Badge variant={recommendationVariant(b.recommendation)}>
                {b.recommendation}
              </Badge>
            ) : null}
            {data.score !== null ? (
              <span
                className={`flex size-11 items-center justify-center rounded-full text-sm font-bold tabular-nums ring-1 ${scoreCircle(
                  data.score,
                )}`}
              >
                {data.score}
              </span>
            ) : (
              <Badge variant="outline">unscored</Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {data.scoreSummary ? (
          <p className="text-sm">{data.scoreSummary}</p>
        ) : (
          <p className="text-muted-foreground text-sm">Not scored yet.</p>
        )}

        {b ? (
          <Accordion multiple={false}>
            <AccordionItem value="breakdown">
              <AccordionTrigger className="text-sm">
                View breakdown
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-4">
                {b.criteria_breakdown.length ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      Criteria
                    </p>
                    <ul className="flex flex-col gap-2">
                      {b.criteria_breakdown.map((c, i) => (
                        <li key={i} className="text-sm">
                          <span className={c.met ? "text-foreground" : "text-muted-foreground"}>
                            {c.met ? "✓" : "✗"} {c.criterion}
                          </span>
                          <div className="text-muted-foreground pl-4 text-xs">
                            {c.evidence}
                            {c.weight_note ? ` — ${c.weight_note}` : ""}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {b.strengths.length ? (
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      Strengths
                    </p>
                    <ul className="list-disc pl-5 text-sm">
                      {b.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {b.gaps.length ? (
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      Gaps
                    </p>
                    <ul className="list-disc pl-5 text-sm">
                      {b.gaps.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : null}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRescore}
            disabled={pending}
          >
            {pending && !deleting ? "Reviewing…" : "Re-review"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={pending}
          >
            Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
