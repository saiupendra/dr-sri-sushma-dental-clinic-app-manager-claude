import { get, set, del } from "idb-keyval";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { queryCacheStore } from "./storage.js";

/**
 * Persists the whole React Query cache to IndexedDB and restores it on
 * startup. This is what lets staff open a patient they viewed earlier, or a
 * day's appointment list, while offline or after a full app restart — no
 * per-entity caching code needed, it works for every query in the app.
 */
export const queryPersister = createAsyncStoragePersister({
  storage: {
    getItem: (key: string) => get(key, queryCacheStore),
    setItem: (key: string, value: string) => set(key, value, queryCacheStore),
    removeItem: (key: string) => del(key, queryCacheStore),
  },
  key: "clinic-app-query-cache",
});
