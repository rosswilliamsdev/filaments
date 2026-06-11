import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { FilamentDetail } from "../lib/types";

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
