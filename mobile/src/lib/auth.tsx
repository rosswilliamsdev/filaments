import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, setSessionExpiredHandler } from "./api";
import { clearTokens, getAccess, saveTokens } from "./tokens";

type AuthStatus = "loading" | "signedOut" | "signedIn";

interface AuthContextValue {
  status: AuthStatus;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAccess().then((token) => setStatus(token ? "signedIn" : "signedOut"));
    setSessionExpiredHandler(() => setStatus("signedOut"));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      error,
      async signIn() {
        setError(null);
        try {
          const result = await GoogleSignin.signIn();
          if (result.type !== "success") return; // user cancelled
          const idToken = result.data.idToken;
          if (!idToken) throw new Error("Google returned no ID token");
          const tokens = await api<{ access: string; refresh: string }>(
            "/auth/google",
            { method: "POST", body: JSON.stringify({ id_token: idToken }) },
          );
          await saveTokens(tokens.access, tokens.refresh);
          setStatus("signedIn");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Sign-in failed");
        }
      },
      async signOut() {
        await GoogleSignin.signOut().catch(() => {});
        await clearTokens();
        setStatus("signedOut");
      },
    }),
    [status, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
