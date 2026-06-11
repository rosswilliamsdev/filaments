import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { FilamentDetail } from "../lib/types";

/** Detail query; polls every 2.5s while the pipeline runs, stops when settled. */
export function useFilament(id: string) {
  return useQuery({
    queryKey: ["filament", id],
    queryFn: () => api<FilamentDetail>(`/filaments/${id}`),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "processing" || status === "pending_upload" ? 2500 : false;
    },
  });
}
