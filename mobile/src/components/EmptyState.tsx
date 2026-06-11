import { SymbolView, type SFSymbol } from "expo-symbols";
import { Text, View } from "react-native";

interface EmptyStateProps {
  symbol: SFSymbol;
  title: string;
  line: string;
}

export function EmptyState({ symbol, title, line }: EmptyStateProps) {
  return (
    <View className="items-center px-10 py-16">
      <SymbolView name={symbol} tintColor="#d4c5b5" size={40} />
      <Text className="mt-5 text-center font-serif text-lg text-neutral-800">
        {title}
      </Text>
      <Text className="mt-2 text-center font-sans text-sm leading-5 text-neutral-500">
        {line}
      </Text>
    </View>
  );
}
