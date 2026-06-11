import { Text, View } from "react-native";

// design-system.md → Badge / Tag: brand-100 bg, brand-700 text, radius-full,
// text-xs font-medium, spacing-1/spacing-2 padding.
export function TagChip({ name }: { name: string }) {
  return (
    <View className="rounded-full bg-brand-100 px-2 py-1">
      <Text className="font-sans-medium text-xs text-brand-700">{name}</Text>
    </View>
  );
}
