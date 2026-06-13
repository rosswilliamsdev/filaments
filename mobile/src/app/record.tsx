import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Waveform } from "../components/Waveform";
import { useVoiceUpload } from "../hooks/mutations";

type Phase = "requesting" | "denied" | "recording" | "paused" | "uploading";

/** mm:ss with a padded minutes field (00:00) for the fixed-width timer. */
function timer(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function RecordScreen() {
  // Metering on → the waveform is audio-reactive; 100ms poll keeps it smooth.
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const state = useAudioRecorderState(recorder, 100);
  const upload = useVoiceUpload();

  const [phase, setPhase] = useState<Phase>("requesting");
  // Local bookmark timestamps (ms). There's no backend field yet — these mark
  // moments for the recorder's own reference; persisting them is a later task.
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const started = useRef(false);

  // Request mic permission, set the audio mode, and auto-start — the capture
  // flow is meant to be hands-free (you may have triggered it by voice), so the
  // screen opens already recording rather than waiting for a tap.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const granted = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted.granted) {
        setPhase("denied");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase("recording");
    })();
  }, [recorder]);

  const togglePause = useCallback(() => {
    if (phase === "recording") {
      recorder.pause();
      setPhase("paused");
    } else if (phase === "paused") {
      recorder.record();
      setPhase("recording");
    }
  }, [phase, recorder]);

  const addBookmark = useCallback(() => {
    setBookmarks((prev) => [...prev, state.durationMillis]);
  }, [state.durationMillis]);

  const finish = useCallback(async () => {
    setPhase("uploading");
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) {
      Alert.alert("Recording failed", "No audio was captured.", [
        { text: "OK", onPress: () => router.back() },
      ]);
      return;
    }
    upload.mutate(
      { uri, title: "" },
      {
        onSuccess: () => router.back(),
        // Stay on-screen with the local file intact so the user can retry the
        // upload without losing the recording.
        onError: () => setPhase("paused"),
      },
    );
  }, [recorder, upload]);

  const discard = useCallback(() => {
    const close = async () => {
      if (state.isRecording || phase === "paused") await recorder.stop();
      router.back();
    };
    if (phase === "recording" || phase === "paused") {
      Alert.alert("Discard recording?", "This recording won't be saved.", [
        { text: "Keep recording", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: close },
      ]);
    } else {
      close();
    }
  }, [phase, recorder, state.isRecording]);

  return (
    <SafeAreaView className="flex-1 bg-brand-50">
      {/* Header */}
      <View className="flex-row items-center px-4 pb-2 pt-1">
        <Pressable
          onPress={discard}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close and discard recording"
          className="h-11 w-11 items-center justify-center"
        >
          <SymbolView name="xmark" tintColor="#3d342a" size={20} />
        </Pressable>
        <Text className="flex-1 text-center font-serif-bold text-lg text-brand-900">
          Recording
        </Text>
        <View className="h-11 w-11" />
      </View>

      {phase === "denied" ? (
        <View className="flex-1 items-center justify-center px-10">
          <SymbolView name="mic.slash" tintColor="#b8a48e" size={40} />
          <Text className="mt-4 text-center font-serif text-lg text-neutral-800">
            Microphone access is off
          </Text>
          <Text className="mt-2 text-center font-sans text-sm leading-5 text-neutral-500">
            Enable the microphone for Filaments in Settings to record voice notes.
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-6 h-12 items-center justify-center rounded-md bg-brand-600 px-8 active:bg-brand-700"
          >
            <Text className="font-sans-medium text-base text-neutral-0">Back</Text>
          </Pressable>
        </View>
      ) : (
        <View className="flex-1 items-center justify-between pb-6">
          <View className="flex-1 items-center justify-center">
            {/* Live status pill */}
            <View className="flex-row items-center gap-2 rounded-full border border-neutral-200 bg-neutral-0 px-4 py-2">
              <View
                className={`h-2 w-2 rounded-full ${
                  phase === "recording" ? "bg-error" : "bg-neutral-300"
                }`}
              />
              <Text className="font-mono text-[11px] uppercase tracking-widest text-neutral-500">
                {phase === "paused"
                  ? "Paused"
                  : phase === "uploading"
                    ? "Saving…"
                    : "Live audio stream"}
              </Text>
            </View>

            {/* Timer */}
            <Text
              accessibilityLabel={`Recording length ${timer(state.durationMillis)}`}
              style={{ fontVariant: ["tabular-nums"] }}
              className="mt-8 font-mono text-6xl text-brand-900"
            >
              {timer(state.durationMillis)}
            </Text>

            {bookmarks.length > 0 ? (
              <Text className="mt-2 font-sans text-sm text-neutral-500">
                {bookmarks.length} bookmark{bookmarks.length === 1 ? "" : "s"}
              </Text>
            ) : null}

            <View className="mt-10 w-full">
              <Waveform metering={state.metering} active={phase === "recording"} />
            </View>
          </View>

          {/* Stop = finish + upload */}
          <Pressable
            onPress={finish}
            disabled={phase === "uploading"}
            accessibilityRole="button"
            accessibilityLabel="Stop recording and save"
            style={{ touchAction: "manipulation" }}
            className="h-28 w-28 items-center justify-center rounded-full bg-brand-900 shadow-lg active:bg-brand-800"
          >
            {phase === "uploading" ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <View className="h-9 w-9 rounded-md bg-neutral-0" />
            )}
          </Pressable>

          {/* Pause/resume + bookmark */}
          <View className="mt-8 flex-row gap-6">
            <Pressable
              onPress={togglePause}
              disabled={phase === "uploading"}
              accessibilityRole="button"
              accessibilityLabel={phase === "paused" ? "Resume recording" : "Pause recording"}
              className="h-14 w-14 items-center justify-center rounded-full bg-neutral-100 active:bg-neutral-200"
            >
              <SymbolView
                name={phase === "paused" ? "play.fill" : "pause.fill"}
                tintColor="#3d342a"
                size={20}
              />
            </Pressable>
            <Pressable
              onPress={addBookmark}
              disabled={phase !== "recording"}
              accessibilityRole="button"
              accessibilityLabel="Bookmark this moment"
              className="h-14 w-14 items-center justify-center rounded-full bg-neutral-100 active:bg-neutral-200"
            >
              <SymbolView name="bookmark" tintColor="#3d342a" size={20} />
            </Pressable>
          </View>

          {upload.isError ? (
            <Text className="mt-4 px-8 text-center font-sans text-sm text-error">
              {upload.error instanceof Error ? upload.error.message : "Upload failed"}
            </Text>
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
}
