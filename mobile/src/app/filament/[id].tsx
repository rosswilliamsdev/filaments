import { Link, router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { StatusBadge, TypeBadge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { TagChip } from "../../components/TagChip";
import { useToggleActionItem } from "../../hooks/mutations";
import { useFilament } from "../../hooks/useFilament";
import { clockTime, relativeTime } from "../../lib/format";

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="mb-2 mt-7 font-mono text-[11px] uppercase tracking-widest text-neutral-400">
      {children}
    </Text>
  );
}

export default function FilamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: filament, isLoading, isError } = useFilament(id);
  const toggle = useToggleActionItem(id);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-neutral-0">
      <View className="flex-row items-center px-3 pb-1 pt-1">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back to timeline"
          className="flex-row items-center gap-1 py-2 pr-3"
        >
          <SymbolView name="chevron.left" tintColor="#7d6750" size={17} />
          <Text className="font-sans text-[15px] text-brand-600">Timeline</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View className="py-24">
          <ActivityIndicator color="#9c8368" />
        </View>
      ) : isError || !filament ? (
        <EmptyState
          symbol="exclamationmark.triangle"
          title="Couldn't load this filament"
          line="Pull back to the timeline and try again."
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
          <View className="flex-row items-center gap-2">
            <TypeBadge type={filament.type} />
            <StatusBadge status={filament.status} />
            <View className="flex-1" />
            <Text className="font-mono text-[11px] text-neutral-400">
              {relativeTime(filament.created_at)}
            </Text>
          </View>

          <Text className="mt-3 font-serif text-2xl leading-8 text-neutral-900">
            {filament.title || "Untitled"}
          </Text>

          {filament.status === "processing" || filament.status === "pending_upload" ? (
            <View className="mt-4 rounded-md bg-warning-light p-3.5">
              <Text className="font-sans text-[13px] leading-5 text-warning">
                Processing — content fills in as pipeline steps complete.
              </Text>
            </View>
          ) : null}
          {filament.status === "failed" ? (
            <View className="mt-4 rounded-md bg-error-light p-3.5">
              <Text className="font-sans text-[13px] leading-5 text-error">
                Processing failed. A retry option lands with the pipeline.
              </Text>
            </View>
          ) : null}

          {filament.summary ? (
            <>
              <SectionLabel>Summary</SectionLabel>
              <View className="rounded-md border border-neutral-200 bg-neutral-50 p-4 shadow-sm">
                <Text className="font-sans text-[15px] leading-6 text-neutral-700">
                  {filament.summary}
                </Text>
              </View>
            </>
          ) : null}

          {filament.key_ideas.length > 0 ? (
            <>
              <SectionLabel>Key ideas</SectionLabel>
              <View className="gap-2">
                {filament.key_ideas.map((idea) => (
                  <View key={idea} className="flex-row gap-2.5">
                    <Text className="font-sans text-[15px] leading-6 text-brand-500">◆</Text>
                    <Text className="flex-1 font-sans text-[15px] leading-6 text-neutral-700">
                      {idea}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {filament.action_items.length > 0 ? (
            <>
              <SectionLabel>Action items</SectionLabel>
              <View className="rounded-md border border-neutral-200 bg-neutral-50 shadow-sm">
                {filament.action_items.map((item, i) => (
                  <Pressable
                    key={item.id}
                    onPress={() => toggle.mutate({ itemId: item.id, done: !item.done })}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.done }}
                    accessibilityLabel={item.text}
                    className={`flex-row items-center gap-3 p-3.5 active:bg-brand-100 ${
                      i > 0 ? "border-t border-neutral-200" : ""
                    }`}
                  >
                    <SymbolView
                      name={item.done ? "checkmark.circle.fill" : "circle"}
                      tintColor={item.done ? "#16a34a" : "#d6d3d1"}
                      size={22}
                    />
                    <Text
                      className={`flex-1 font-sans text-[15px] leading-5 ${
                        item.done ? "text-neutral-400 line-through" : "text-neutral-800"
                      }`}
                    >
                      {item.text}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {filament.type === "voice" && filament.transcript?.length ? (
            <>
              <SectionLabel>Transcript</SectionLabel>
              <View className="gap-3">
                {filament.transcript.map((segment) => (
                  <View key={segment.start} className="flex-row gap-3">
                    <Text className="w-10 pt-0.5 font-mono text-[11px] text-neutral-400">
                      {clockTime(segment.start)}
                    </Text>
                    <Text className="flex-1 font-sans text-base leading-7 text-neutral-800">
                      {segment.text}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : filament.body ? (
            <>
              <SectionLabel>{filament.type === "document" ? "Extracted text" : "Note"}</SectionLabel>
              <Text className="font-sans text-base leading-7 text-neutral-800">
                {filament.body}
              </Text>
            </>
          ) : null}

          {filament.tags.length > 0 ? (
            <>
              <SectionLabel>Tags</SectionLabel>
              <View className="flex-row flex-wrap gap-1.5">
                {filament.tags.map((tag) => (
                  <TagChip key={tag} name={tag} />
                ))}
              </View>
            </>
          ) : null}

          <SectionLabel>Linked filaments</SectionLabel>
          {filament.links.length > 0 ? (
            <View className="gap-2.5">
              {filament.links.map((link) => (
                <Link key={link.filament_id} href={`/filament/${link.filament_id}`} asChild>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open linked filament: ${link.title}`}
                    className="flex-row items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3.5 shadow-sm active:bg-brand-100"
                  >
                    <TypeBadge type={link.type} />
                    <Text
                      numberOfLines={1}
                      className="flex-1 font-serif text-[15px] text-neutral-800"
                    >
                      {link.title || "Untitled"}
                    </Text>
                    <Text className="font-mono text-[11px] text-neutral-400">
                      {Math.round(link.score * 100)}%
                    </Text>
                  </Pressable>
                </Link>
              ))}
            </View>
          ) : (
            <Text className="font-sans text-sm text-neutral-400">
              No links yet — connections appear as the archive grows.
            </Text>
          )}

          <Text className="mt-10 font-mono text-[10px] text-neutral-300">
            created {new Date(filament.created_at).toLocaleString()} · updated{" "}
            {new Date(filament.updated_at).toLocaleString()}
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
