"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const AVATARS_BUCKET = "avatars";
const AVATAR_EXTS = ["png", "jpg", "jpeg", "webp", "gif"];

/**
 * Upload (or replace) the owner's profile photo. Stored in a public `avatars`
 * Storage bucket (created lazily), with the public URL saved to the auth user's
 * metadata (`avatar_url`) so the shell can read it. Small files only, so a
 * plain server action is fine (well under the serverless body limit).
 */
export async function uploadAvatar(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "No file selected." };
  if (!file.type.startsWith("image/"))
    return { ok: false, error: "Please choose an image file." };
  if (file.size > 5 * 1024 * 1024)
    return { ok: false, error: "Image must be under 5 MB." };

  const admin = createAdminClient();

  // Ensure the public bucket exists (idempotent).
  const { data: bucket } = await admin.storage.getBucket(AVATARS_BUCKET);
  if (!bucket) {
    const { error: bErr } = await admin.storage.createBucket(AVATARS_BUCKET, {
      public: true,
      fileSizeLimit: "5MB",
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    });
    if (bErr && !/exist/i.test(bErr.message))
      return { ok: false, error: bErr.message };
  }

  const ext =
    (file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "") ||
    "png";
  const path = `${user.id}/avatar.${AVATAR_EXTS.includes(ext) ? ext : "png"}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await admin.storage
    .from(AVATARS_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (upErr) return { ok: false, error: upErr.message };

  const { data: pub } = admin.storage.from(AVATARS_BUCKET).getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`; // cache-bust on re-upload

  const { error: updErr } = await supabase.auth.updateUser({
    data: { avatar_url: url },
  });
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/settings/integrations");
  revalidatePath("/", "layout");
  return { ok: true, url };
}

/** Remove the owner's profile photo (clears metadata + best-effort file delete). */
export async function removeAvatar(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase.auth.updateUser({ data: { avatar_url: null } });
  if (error) return { ok: false, error: error.message };

  try {
    const admin = createAdminClient();
    await admin.storage
      .from(AVATARS_BUCKET)
      .remove(AVATAR_EXTS.map((e) => `${user.id}/avatar.${e}`));
  } catch {
    // best-effort; metadata is already cleared
  }

  revalidatePath("/settings/integrations");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function disconnectGoogle(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("integration_tokens")
    .delete()
    .eq("provider", "google");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/integrations");
  return { ok: true };
}

/** Save the owner's Google Appointment Schedule link (candidate self-scheduling). */
export async function saveBookingUrl(
  url: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const trimmed = url.trim();
  if (trimmed && !/^https?:\/\/\S+$/i.test(trimmed)) {
    return { ok: false, error: "Enter a full URL starting with https://" };
  }

  const { error } = await supabase.from("app_settings").upsert(
    { id: 1, booking_url: trimmed || null, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/integrations");
  return { ok: true };
}
