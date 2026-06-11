import { Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "../../components/EmptyState";

export default function AskScreen() {
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-neutral-0">
      <Text className="px-4 pb-3 pt-2 font-serif-bold text-3xl text-brand-900">
        Ask
      </Text>

      <View className="mx-4 rounded-md border border-neutral-200 bg-neutral-100 px-4 opacity-60">
        <TextInput
          editable={false}
          placeholder="Ask your filaments anything…"
          placeholderTextColor="#a8a29e"
          className="py-3.5 font-sans text-base text-neutral-900"
        />
      </View>

      <EmptyState
        symbol="sparkles"
        title="Ask arrives with the pipeline"
        line="Once filaments are embedded, you'll ask questions here and get cited answers drawn from your own archive."
      />
    </SafeAreaView>
  );
}
