import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { relativeTime } from "../lib/format";
import type { FilamentCard as FilamentCardData } from "../lib/types";
import { StatusBadge, TypeBadge } from "./Badge";
import { TagChip } from "./TagChip";

const MAX_TAGS = 3;

// Card spec: surface-raised bg, 1px neutral-200 border, radius-md, shadow-sm,
// spacing-4 padding (design-system.md → Components → Card).
export function FilamentCard({ filament }: { filament: FilamentCardData }) {
  const overflow = filament.tags.length - MAX_TAGS;
  return (
    <Link href={`/filament/${filament.id}`} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open filament: ${filament.title || "untitled"}`}
        className="mb-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 shadow-sm active:bg-brand-100"
      >
        <View className="flex-row items-center gap-2">
          <TypeBadge type={filament.type} />
          {filament.status !== "done" ? <StatusBadge status={filament.status} /> : null}
          <View className="flex-1" />
          <Text className="font-mono text-[11px] text-neutral-400">
            {relativeTime(filament.created_at)}
          </Text>
        </View>

        <Text numberOfLines={1} className="mt-2.5 font-serif text-lg text-neutral-900">
          {filament.title || "Untitled"}
        </Text>

        {filament.snippet ? (
          <Text
            numberOfLines={2}
            className="mt-1 font-sans text-sm leading-5 text-neutral-600"
          >
            {filament.snippet}
          </Text>
        ) : null}

        {filament.tags.length > 0 ? (
          <View className="mt-3 flex-row flex-wrap items-center gap-1.5">
            {filament.tags.slice(0, MAX_TAGS).map((tag) => (
              <TagChip key={tag} name={tag} />
            ))}
            {overflow > 0 ? (
              <Text className="font-sans text-xs text-neutral-400">+{overflow}</Text>
            ) : null}
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
}
