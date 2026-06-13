"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, toApiPath } from "./api";
import type {
  AskResponse,
  CreateFilamentResponse,
  CursorPage,
  FilamentCard,
  FilamentDetail,
  FilamentType,
  OffsetPage,
  TagCount,
} from "./types";

// Query keys match mobile's so the two codebases stay mentally interchangeable.

export interface TimelineFilters {
  type?: FilamentType;
  tag?: string;
  pinned?: boolean;
  archived?: boolean;
}

function timelineQuery(filters: TimelineFilters): string {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.pinned) params.set("pinned", "true");
  if (filters.archived) params.set("archived", "true");
  const qs = params.toString();
  return `/filaments${qs ? `?${qs}` : ""}`;
}

export function useTimeline(filters: TimelineFilters = {}) {
  return useInfiniteQuery({
    queryKey: ["filaments", filters],
    queryFn: ({ pageParam }) =>
      api<CursorPage<FilamentCard>>(pageParam ?? timelineQuery(filters)),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.next ? toApiPath(last.next) : null),
  });
}

export function useFilament(id: string) {
  return useQuery({
    queryKey: ["filament", id],
    queryFn: () => api<FilamentDetail>(`/filaments/${id}`),
    // Poll while the pipeline runs; stop on done/failed.
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ||
      query.state.data?.status === "pending_upload"
        ? 3000
        : false,
  });
}

export function useSearch(q: string, type?: FilamentType) {
  const params = new URLSearchParams({ q });
  if (type) params.set("type", type);
  return useQuery({
    queryKey: ["search", q, type ?? null],
    queryFn: () => api<OffsetPage<FilamentCard>>(`/search?${params}`),
    enabled: q.trim().length > 0,
  });
}

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => api<TagCount[]>("/tags"),
  });
}

export function useCreateFilament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      type: FilamentType;
      title?: string;
      body?: string;
      // Documents declare their format so the backend picks the right S3 key
      // extension and extraction path (pdf/docx/markdown).
      filename?: string;
    }) =>
      api<CreateFilamentResponse>("/filaments", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["filaments"] }),
  });
}

export function useProcessFilament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/filaments/${id}/process`, { method: "POST" }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["filament", id] });
      qc.invalidateQueries({ queryKey: ["filaments"] });
    },
  });
}

export function usePatchFilament(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      patch: Partial<
        Pick<FilamentDetail, "title" | "body" | "pinned" | "archived" | "tags">
      >,
    ) =>
      api<FilamentDetail>(`/filaments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: (detail) => {
      qc.setQueryData(["filament", id], detail);
      qc.invalidateQueries({ queryKey: ["filaments"] });
    },
  });
}

export function useDeleteFilament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/filaments/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["filaments"] }),
  });
}

export function useToggleActionItem(filamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, done }: { itemId: number; done: boolean }) =>
      api(`/filaments/${filamentId}/action-items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ done }),
      }),
    // Optimistic toggle; rollback on failure (frontend-rules → Feedback).
    onMutate: async ({ itemId, done }) => {
      await qc.cancelQueries({ queryKey: ["filament", filamentId] });
      const previous = qc.getQueryData<FilamentDetail>(["filament", filamentId]);
      if (previous) {
        qc.setQueryData<FilamentDetail>(["filament", filamentId], {
          ...previous,
          action_items: previous.action_items.map((item) =>
            item.id === itemId ? { ...item, done } : item,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(["filament", filamentId], context.previous);
      }
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: ["filament", filamentId] }),
  });
}

export function useAsk() {
  return useMutation({
    mutationFn: (question: string) =>
      api<AskResponse>("/ask", {
        method: "POST",
        body: JSON.stringify({ question }),
      }),
  });
}