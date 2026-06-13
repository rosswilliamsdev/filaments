import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "../lib/api";
import type { FilamentDetail } from "../lib/types";

/**
 * Voice capture handshake (mirrors the text-note path, plus the S3 leg):
 *   1. POST /filaments {type: voice} → { filament_id, upload_url }  (auth'd JSON)
 *   2. PUT the recorded .m4a straight to `upload_url`               (raw, no auth)
 *   3. POST /filaments/{id}/process → enqueue the pipeline          (auth'd JSON)
 *
 * The PUT must NOT go through `api()` — that helper forces a JSON content-type,
 * prepends /api/v1, and attaches the JWT, all of which would break the presigned
 * S3 request. If step 2 or 3 fails, the row sits in `pending_upload` and the
 * orphaned-upload sweep reaps it after 24h, so we just surface a retryable error.
 */
export function useVoiceUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ uri, title }: { uri: string; title: string }) => {
      const created = await api<{ filament_id: string; upload_url: string | null }>(
        "/filaments",
        { method: "POST", body: JSON.stringify({ type: "voice", title }) },
      );
      if (!created.upload_url) {
        throw new ApiError("Voice uploads aren't configured on the server.", 503);
      }

      const fileResponse = await fetch(uri);
      const blob = await fileResponse.blob();
      const put = await fetch(created.upload_url, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": "audio/m4a" },
      });
      if (!put.ok) {
        throw new ApiError(`Upload failed (${put.status}) — tap to retry.`, put.status);
      }

      await api(`/filaments/${created.filament_id}/process`, { method: "POST" });
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["filaments"] });
    },
  });
}

/** Text-note capture: create → confirm /process (same handshake as files). */
export function useCreateTextNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ title, body }: { title: string; body: string }) => {
      const created = await api<{ filament_id: string; upload_url: string | null }>(
        "/filaments",
        { method: "POST", body: JSON.stringify({ type: "text", title, body }) },
      );
      await api(`/filaments/${created.filament_id}/process`, { method: "POST" });
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["filaments"] });
    },
  });
}

/** Optimistic action-item toggle; rolls back on error. */
export function useToggleActionItem(filamentId: string) {
  const queryClient = useQueryClient();
  const key = ["filament", filamentId];
  return useMutation({
    mutationFn: ({ itemId, done }: { itemId: number; done: boolean }) =>
      api(`/filaments/${filamentId}/action-items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ done }),
      }),
    onMutate: async ({ itemId, done }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<FilamentDetail>(key);
      if (previous) {
        queryClient.setQueryData<FilamentDetail>(key, {
          ...previous,
          action_items: previous.action_items.map((item) =>
            item.id === itemId ? { ...item, done } : item,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
