export type FilamentType = "voice" | "document" | "text";
export type FilamentStatus = "pending_upload" | "processing" | "done" | "failed";

export interface FilamentCard {
  id: string;
  type: FilamentType;
  title: string;
  snippet: string;
  status: FilamentStatus;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  tags: string[];
}

export interface ActionItem {
  id: number;
  text: string;
  done: boolean;
  created_at: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  speaker: string | null;
  text: string;
}

export interface LinkedFilament {
  filament_id: string;
  title: string;
  type: FilamentType;
  score: number;
}

export interface FilamentDetail {
  id: string;
  type: FilamentType;
  title: string;
  body: string;
  summary: string;
  key_ideas: string[];
  transcript: TranscriptSegment[] | null;
  status: FilamentStatus;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
  tags: string[];
  action_items: ActionItem[];
  links: LinkedFilament[];
}

/** DRF CursorPagination (timeline) */
export interface CursorPage<T> {
  next: string | null;
  previous: string | null;
  results: T[];
}

/** DRF LimitOffsetPagination (search) */
export interface OffsetPage<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
