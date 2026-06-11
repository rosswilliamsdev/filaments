import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "../../components/EmptyState";
import { FilamentCard } from "../../components/FilamentCard";
import { Pill } from "../../components/Pill";
import { useFilaments } from "../../hooks/useFilaments";
import { useAuth } from "../../lib/auth";
import { dayLabel } from "../../lib/format";
import type { CursorPage, FilamentCard as CardData, FilamentType } from "../../lib/types";

const FILTERS: { label: string; value?: FilamentType }[] = [
  { label: "All" },
  { label: "Voice", value: "voice" },
  { label: "Docs", value: "document" },
  { label: "Text", value: "text" },
];

type Row =
  | { kind: "header"; key: string; label: string }
  | { kind: "card"; key: string; filament: CardData };

function buildRows(pages?: CursorPage<CardData>[]): Row[] {
  const rows: Row[] = [];
  let lastLabel: string | null = null;
  for (const filament of pages?.flatMap((p) => p.results) ?? []) {
    const label = dayLabel(filament.created_at);
    if (label !== lastLabel) {
      rows.push({ kind: "header", key: `header-${label}`, label });
      lastLabel = label;
    }
    rows.push({ kind: "card", key: filament.id, filament });
  }
  return rows;
}

export default function TimelineScreen() {
  const [type, setType] = useState<FilamentType | undefined>(undefined);
  const { signOut } = useAuth();
  const query = useFilaments(type);
  const rows = useMemo(() => buildRows(query.data?.pages), [query.data?.pages]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-neutral-0">
      <View className="flex-row items-center px-4 pb-3 pt-2">
        <Text className="flex-1 font-serif-bold text-3xl text-brand-900">
          Filaments
        </Text>
        <Pressable
          onPress={signOut}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <SymbolView name="person.crop.circle" tintColor="#a8a29e" size={24} />
        </Pressable>
      </View>

      <View className="flex-row gap-2 px-4 pb-1">
        {FILTERS.map((f) => (
          <Pill
            key={f.label}
            label={f.label}
            selected={type === f.value}
            onPress={() => setType(f.value)}
          />
        ))}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 }}
        renderItem={({ item }) =>
          item.kind === "header" ? (
            <Text className="mb-2 mt-4 font-mono text-[11px] uppercase tracking-widest text-neutral-400">
              {item.label}
            </Text>
          ) : (
            <FilamentCard filament={item.filament} />
          )
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isFetchingNextPage}
            onRefresh={() => query.refetch()}
            tintColor="#9c8368"
          />
        }
        ListEmptyComponent={
          query.isLoading ? (
            <View className="py-24">
              <ActivityIndicator color="#9c8368" />
            </View>
          ) : query.isError ? (
            <EmptyState
              symbol="wifi.exclamationmark"
              title="Couldn't reach the backend"
              line="Check that the Django server is running and EXPO_PUBLIC_API_URL points at it."
            />
          ) : (
            <EmptyState
              symbol="moon.stars"
              title="Nothing captured yet"
              line="Your first filament will land here. Try the Capture tab."
            />
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <View className="py-4">
              <ActivityIndicator color="#9c8368" />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
