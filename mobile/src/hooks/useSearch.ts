import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { FilamentCard, FilamentType, OffsetPage } from "../lib/types";

export function useSearch(q: string, type?: FilamentType) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: ["search", trimmed, type ?? "all"],
    queryFn: () =>
      api<OffsetPage<FilamentCard>>(
        `/search?q=${encodeURIComponent(trimmed)}${type ? `&type=${type}` : ""}`,
      ),
    enabled: trimmed.length > 0,
    placeholderData: (previous) => previous, // keep last results while typing
  });
}
