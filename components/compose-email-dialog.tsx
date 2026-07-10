"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendCandidateEmail } from "@/app/jobs/actions";
import {
  EMAIL_TEMPLATES,
  renderTemplate,
  type EmailTemplateId,
} from "@/lib/email-templates";

interface Props {
  applicationId: string;
  jobId: string;
  candidateName: string;
  candidateEmail: string | null;
  jobTitle: string;
  defaultTemplate?: EmailTemplateId;
  triggerLabel?: string;
  // Controlled mode (e.g. board rejected-drop). Omit for a self-triggering button.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ComposeEmailDialog(props: Props) {
  const controlled = props.open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlled ? (props.open as boolean) : internalOpen;
  const setOpen = controlled
    ? (props.onOpenChange ?? (() => {}))
    : setInternalOpen;

  const defaultTemplate = props.defaultTemplate ?? "outreach";
  const initial = renderTemplate(defaultTemplate, {
    candidateName: props.candidateName,
    jobTitle: props.jobTitle,
  });

  const [templateId, setTemplateId] = useState<EmailTemplateId>(defaultTemplate);
  const [to, setTo] = useState(props.candidateEmail ?? "");
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [sending, setSending] = useState(false);

  function applyTemplate(id: EmailTemplateId) {
    setTemplateId(id);
    const r = renderTemplate(id, {
      candidateName: props.candidateName,
      jobTitle: props.jobTitle,
    });
    setSubject(r.subject);
    setBody(r.body);
  }

  async function onSend() {
    if (!to.trim()) {
      toast.error("Add a recipient email address.");
      return;
    }
    setSending(true);
    const res = await sendCandidateEmail(props.applicationId, props.jobId, {
      to: to.trim(),
      subject,
      body,
    });
    setSending(false);
    if (!res.ok) {
      toast.error(res.error);
    } else {
      toast.success(`Email sent to ${to.trim()}`);
      setOpen(false);
    }
  }

  return (
    <>
      {!controlled ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setInternalOpen(true)}
        >
          {props.triggerLabel ?? "Email"}
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Email {props.candidateName}</DialogTitle>
            <DialogDescription>
              Sent from your connected Google account and logged to this
              candidate.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              {EMAIL_TEMPLATES.map((t) => (
                <Button
                  key={t.id}
                  type="button"
                  size="sm"
                  variant={templateId === t.id ? "default" : "outline"}
                  onClick={() => applyTemplate(t.id)}
                >
                  {t.label}
                </Button>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email-to">To</Label>
              <Input
                id="email-to"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="candidate@example.com"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email-body">Message</Label>
              <Textarea
                id="email-body"
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={onSend} disabled={sending}>
              {sending ? "Sending…" : "Send email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
