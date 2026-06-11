import { SymbolView } from "expo-symbols";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCreateTextNote } from "../../hooks/mutations";

// Static stand-in for the live recording waveform (Plaud reference) until
// expo-audio + S3 land with the pipeline.
const WAVEFORM_HEIGHTS = [8, 14, 22, 12, 28, 18, 10, 24, 16, 30, 12, 20, 8, 26, 14, 18, 10, 22];

export default function CaptureScreen() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const create = useCreateTextNote();

  const handleSave = () => {
    create.mutate(
      { title: title.trim(), body: body.trim() },
      {
        onSuccess: () => {
          setTitle("");
          setBody("");
          setSavedAt(Date.now());
        },
      },
    );
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-neutral-0">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="pb-3 pt-2 font-serif-bold text-3xl text-brand-900">
            Capture
          </Text>

          <View className="items-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-8">
            <View className="h-12 flex-row items-center gap-[3px]">
              {WAVEFORM_HEIGHTS.map((h, i) => (
                <View
                  key={i}
                  style={{ height: h }}
                  className="w-[3px] rounded-full bg-brand-300"
                />
              ))}
            </View>
            <View className="mt-4 flex-row items-center gap-2">
              <SymbolView name="mic.fill" tintColor="#b8a48e" size={16} />
              <Text className="font-sans text-sm text-neutral-500">
                Voice capture arrives with the AI pipeline
              </Text>
            </View>
          </View>

          <Text className="mb-2 mt-8 font-mono text-[11px] uppercase tracking-widest text-neutral-400">
            Quick text note
          </Text>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title (optional)…"
            placeholderTextColor="#a8a29e"
            autoCapitalize="sentences"
            className="rounded-md border border-neutral-200 bg-neutral-100 px-4 py-3.5 font-serif text-base text-neutral-900"
          />
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="What's on your mind?…"
            placeholderTextColor="#a8a29e"
            multiline
            textAlignVertical="top"
            className="mt-3 h-44 rounded-md border border-neutral-200 bg-neutral-100 px-4 py-3.5 font-sans text-base leading-6 text-neutral-800"
          />

          <Pressable
            onPress={handleSave}
            disabled={create.isPending}
            accessibilityRole="button"
            className="mt-4 h-12 flex-row items-center justify-center gap-2 rounded-md bg-brand-600 active:bg-brand-700"
          >
            {create.isPending ? <ActivityIndicator size="small" color="#ffffff" /> : null}
            <Text className="font-sans-medium text-base text-neutral-0">
              Save filament
            </Text>
          </Pressable>

          {create.isError ? (
            <Text className="mt-3 font-sans text-sm text-error">
              {create.error instanceof Error ? create.error.message : "Save failed"}
            </Text>
          ) : null}
          {savedAt && !create.isPending && !create.isError ? (
            <Text className="mt-3 font-sans text-sm text-success">
              Saved — it'll show as processing until the pipeline lands.
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
