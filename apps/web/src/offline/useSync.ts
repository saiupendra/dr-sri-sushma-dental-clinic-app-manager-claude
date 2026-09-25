import { useContext } from "react";
import { SyncContext, type SyncContextValue } from "./SyncContext.js";

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within a SyncProvider");
  return ctx;
}
