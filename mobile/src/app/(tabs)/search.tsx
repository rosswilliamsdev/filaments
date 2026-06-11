import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, TextInput, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "../../components/EmptyState";
import { FilamentCard } from "../../components/FilamentCard";
import { Pill } from "../../components/Pill";
import { useSearch } from "../../hooks/useSearch";
import type { FilamentType } from "../../lib/types";

const FILTERS: { label: string; value?: FilamentType }[] = [
  { label: "All" },
  { label: "Voice", value: "voice" },
  { label: "Docs", value: "document" },
  { label: "Text", value: "text" },
];

export default function SearchScreen() {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState<FilamentType | undefined>(undefined);

  useEffect(() => {
    const handle = setTimeout(() => setQ(input), 300);
    return () => clearTimeout(handle);
  }, [input]);

  const search = useSearch(q, type);
  const results = search.data?.results ?? [];

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-neutral-0">
      <Text className="px-4 pb-3 pt-2 font-serif-bold text-3xl text-brand-900">
        Search
      </Text>

      <View className="mx-4 flex-row items-center gap-2.5 rounded-md border border-neutral-200 bg-neutral-100 px-3.5">
        <SymbolView name="magnifyingglass" tintColor="#a8a29e" size={16} />
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Search your filaments…"
          placeholderTextColor="#a8a29e"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          className="flex-1 py-3.5 font-sans text-base text-neutral-900"
        />
        {search.isFetching ? <ActivityIndicator size="small" color="#9c8368" /> : null}
      </View>

      <View className="flex-row gap-2 px-4 pt-3">
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
        data={results}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32 }}
        renderItem={({ item }) => <FilamentCard filament={item} />}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          q.trim().length === 0 ? (
            <EmptyState
              symbol="text.magnifyingglass"
              title="Search your filaments"
              line="Full-text across titles, content, and summaries."
            />
          ) : search.isLoading ? (
            <View className="py-24">
              <ActivityIndicator color="#9c8368" />
            </View>
          ) : (
            <EmptyState
              symbol="questionmark.circle"
              title="No matches"
              line={`Nothing in your filaments matches "${q.trim()}".`}
            />
          )
        }
      />
    </SafeAreaView>
  );
}
