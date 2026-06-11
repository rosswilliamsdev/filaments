import { useInfiniteQuery } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { CursorPage, FilamentCard, FilamentType } from "../lib/types";

/** Cursor-paginated timeline; pageParam is the absolute `next` URL from DRF. */
export function useFilaments(type?: FilamentType) {
  return useInfiniteQuery({
    queryKey: ["filaments", type ?? "all"],
    queryFn: ({ pageParam }) =>
      api<CursorPage<FilamentCard>>(
        pageParam ?? `/filaments${type ? `?type=${type}` : ""}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next,
  });
}
