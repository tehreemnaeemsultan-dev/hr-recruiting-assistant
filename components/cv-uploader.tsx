"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  createUploadTargets,
  ingestCandidates,
} from "@/app/jobs/actions";
import { Button } from "@/components/ui/button";
import { RESUMES_BUCKET_NAME } from "@/lib/constants";

const MAX_FILES = 20;

export function CvUploader({ jobId }: { jobId: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []).filter(
      (f) =>
        f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    setFiles(selected);
  }

  async function handleUpload() {
    if (!files.length) {
      toast.error("Select one or more PDF files first.");
      return;
    }
    let batch = files;
    if (batch.length > MAX_FILES) {
      toast.warning(`Only the first ${MAX_FILES} files will be processed.`);
      batch = batch.slice(0, MAX_FILES);
    }

    setBusy(true);
    try {
      setStatus("Preparing upload…");
      const res = await createUploadTargets(
        jobId,
        batch.map((f) => ({ name: f.name })),
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      const supabase = createClient();
      setStatus(`Uploading ${res.targets.length} file(s)…`);
      for (let i = 0; i < res.targets.length; i++) {
        const t = res.targets[i];
        const { error } = await supabase.storage
          .from(RESUMES_BUCKET_NAME)
          .uploadToSignedUrl(t.path, t.token, batch[i]);
        if (error) {
          throw new Error(`Upload failed for ${batch[i].name}: ${error.message}`);
        }
      }

      setStatus("Reading and reviewing…");
      const ing = await ingestCandidates(
        jobId,
        res.targets.map((t) => ({ path: t.path, name: t.name })),
      );
      if (!ing.ok) {
        toast.error(ing.error);
        return;
      }

      let msg = `${ing.ingested} CV${ing.ingested === 1 ? "" : "s"} added`;
      if (ing.scoringConfigured) {
        msg += ` · ${ing.scored} scored`;
      } else {
        msg += " · scoring not configured yet";
      }
      if (ing.scoreErrors) msg += ` · ${ing.scoreErrors} scoring error(s)`;
      toast.success(msg);
      for (const f of ing.failures) {
        toast.error(`${f.name}: ${f.error}`);
      }

      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        onChange={onSelect}
        disabled={busy}
        className="file:bg-secondary file:text-secondary-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm block w-full cursor-pointer rounded-md border text-sm text-muted-foreground"
      />
      <div className="flex items-center gap-3">
        <Button type="button" onClick={handleUpload} disabled={busy || !files.length}>
          {busy ? "Working…" : `Upload & review${files.length ? ` (${files.length})` : ""}`}
        </Button>
        {status ? (
          <span className="text-muted-foreground text-sm">{status}</span>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">
        PDF only, up to {MAX_FILES} at a time. We&apos;ll read each CV and rank
        people for this role.
      </p>
    </div>
  );
}
