import { Pressable, Text } from "react-native";

interface PillProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

// Active state per design-system.md → Nav: brand-600 text on a brand-100 pill.
export function Pill({ label, selected, onPress }: PillProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`rounded-full border px-3.5 py-1.5 ${
        selected
          ? "border-transparent bg-brand-100"
          : "border-neutral-200 bg-neutral-0"
      }`}
    >
      <Text
        className={`font-sans-medium text-sm ${
          selected ? "text-brand-600" : "text-neutral-500"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
