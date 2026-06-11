import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../lib/auth";

export default function SignInScreen() {
  const { signIn, error } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    setBusy(true);
    try {
      await signIn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-50">
      <View className="flex-1 items-center justify-center px-10">
        <Text className="font-serif-bold text-[40px] text-brand-900">Filaments</Text>
        <Text className="mt-3 text-center font-sans text-[15px] leading-6 text-neutral-500">
          Speak a thought. Find it forever.
        </Text>

        <Pressable
          onPress={handleSignIn}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Sign in with Google"
          className="mt-14 w-full flex-row items-center justify-center gap-3 rounded-full border border-neutral-200 bg-neutral-0 py-4 active:bg-neutral-50"
        >
          {busy ? <ActivityIndicator size="small" color="#78716c" /> : null}
          <Text className="font-sans-medium text-base text-neutral-800">
            Sign in with Google
          </Text>
        </Pressable>

        {error ? (
          <Text className="mt-4 text-center font-sans text-sm text-error">{error}</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
