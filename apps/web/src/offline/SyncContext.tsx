import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { flushOutbox, listOutbox, type OutboxItem } from "./outbox.js";
import { useOnlineStatus } from "./useOnlineStatus.js";

export interface SyncContextValue {
  isOnline: boolean;
  pending: OutboxItem[];
  isSyncing: boolean;
  syncNow: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components -- context lives beside its provider on purpose; see useSync.ts
export const SyncContext = createContext<SyncContextValue | null>(null);

const RETRY_INTERVAL_MS = 30_000;

export function SyncProvider({ children }: { children: ReactNode }) {
  const isOnline = useOnlineStatus();
  const [pending, setPending] = useState<OutboxItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();
  const syncingRef = useRef(false);

  const refreshPending = useCallback(async () => {
    setPending(await listOutbox());
  }, []);

  const syncNow = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await flushOutbox();
      if (result.succeeded > 0 || result.failed > 0) {
        // Queued writes may have changed anything; a full invalidate is
        // simplest and cheap at this app's scale (one small clinic).
        await queryClient.invalidateQueries();
      }
    } finally {
      await refreshPending();
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [queryClient, refreshPending]);

  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    if (isOnline) void syncNow();
  }, [isOnline, syncNow]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine) void syncNow();
    }, RETRY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [syncNow]);

  return (
    <SyncContext.Provider value={{ isOnline, pending, isSyncing, syncNow }}>{children}</SyncContext.Provider>
  );
}
