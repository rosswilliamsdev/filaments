import * as SecureStore from "expo-secure-store";

const ACCESS = "fil_access";
const REFRESH = "fil_refresh";

export const saveTokens = (access: string, refresh: string) =>
  Promise.all([
    SecureStore.setItemAsync(ACCESS, access),
    SecureStore.setItemAsync(REFRESH, refresh),
  ]);

export const getAccess = () => SecureStore.getItemAsync(ACCESS);

export const getRefresh = () => SecureStore.getItemAsync(REFRESH);

export const clearTokens = () =>
  Promise.all([
    SecureStore.deleteItemAsync(ACCESS),
    SecureStore.deleteItemAsync(REFRESH),
  ]);
