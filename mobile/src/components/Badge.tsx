import { Text, View } from "react-native";

import type { FilamentStatus, FilamentType } from "../lib/types";

// Type badges: filament type color at 10% opacity bg, full color text
// (design-system.md → Components → Badge / Tag).
const TYPE_STYLES: Record<FilamentType, { label: string; bg: string; text: string }> = {
  voice: { label: "VOICE", bg: "bg-type-voice/10", text: "text-type-voice" },
  document: { label: "DOC", bg: "bg-type-document/10", text: "text-type-document" },
  text: { label: "TEXT", bg: "bg-type-text/10", text: "text-type-text" },
};

export function TypeBadge({ type }: { type: FilamentType }) {
  const s = TYPE_STYLES[type];
  return (
    <View className={`rounded-full px-2 py-1 ${s.bg}`}>
      <Text className={`font-mono text-[10px] tracking-widest ${s.text}`}>{s.label}</Text>
    </View>
  );
}

const STATUS_STYLES: Record<FilamentStatus, { label: string; bg: string; text: string }> = {
  pending_upload: { label: "Queued", bg: "bg-neutral-100", text: "text-neutral-500" },
  processing: { label: "Processing…", bg: "bg-warning-light", text: "text-warning" },
  done: { label: "Done", bg: "bg-success-light", text: "text-success" },
  failed: { label: "Failed", bg: "bg-error-light", text: "text-error" },
};

export function StatusBadge({ status }: { status: FilamentStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <View className={`rounded-full px-2 py-1 ${s.bg}`}>
      <Text className={`font-sans-medium text-[11px] ${s.text}`}>{s.label}</Text>
    </View>
  );
}
