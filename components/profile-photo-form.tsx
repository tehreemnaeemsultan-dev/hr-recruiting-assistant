"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadAvatar, removeAvatar } from "@/app/settings/actions";

function initials(email?: string | null) {
  if (!email) return "MH";
  const name = email.split("@")[0];
  const parts = name.split(/[._-]+/).filter(Boolean);
  return (
    ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() ||
    name.slice(0, 2).toUpperCase()
  );
}

export function ProfilePhotoForm({
  currentUrl,
  email,
}: {
  currentUrl: string | null;
  email?: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(currentUrl);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const res = await uploadAvatar(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setUrl(res.url);
      toast.success("Profile photo updated.");
      router.refresh();
    });
  }

  function onRemove() {
    startTransition(async () => {
      const res = await removeAvatar();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setUrl(null);
      toast.success("Photo removed.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-4">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Profile"
          className="ring-border size-16 shrink-0 rounded-full object-cover ring-1"
        />
      ) : (
        <span className="avatar-gradient flex size-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold">
          {initials(email)}
        </span>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            className="gap-1.5"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {url ? "Change photo" : "Upload photo"}
          </Button>
          {url ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onRemove}
              disabled={pending}
              className="text-danger hover:bg-danger-bg hover:text-danger gap-1.5"
            >
              <Trash2 className="size-4" /> Remove
            </Button>
          ) : null}
        </div>
        <p className="text-text-tertiary text-xs">JPG, PNG or WebP. Max 5 MB.</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
      />
    </div>
  );
}
