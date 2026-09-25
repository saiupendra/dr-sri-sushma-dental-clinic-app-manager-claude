import { useSync } from "../offline/useSync.js";
import { Badge, Spinner } from "./ui.js";

export function SyncStatusBadge() {
  const { isOnline, pending, isSyncing } = useSync();

  if (!isOnline) {
    return (
      <Badge tone="amber">
        Offline{pending.length > 0 ? ` · ${pending.length} pending` : ""}
      </Badge>
    );
  }
  if (isSyncing || pending.length > 0) {
    return (
      <Badge tone="brand">
        <Spinner /> Syncing {pending.length > 0 ? `${pending.length} change${pending.length === 1 ? "" : "s"}` : ""}
      </Badge>
    );
  }
  return <Badge tone="green">Online</Badge>;
}
