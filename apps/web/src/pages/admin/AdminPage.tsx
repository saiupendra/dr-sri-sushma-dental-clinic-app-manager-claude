import type { SessionSummary } from "@clinic/shared";
import { adminExportUrl, useActiveSessions, useRevokeSession, useStorageStats } from "../../hooks/useAdmin.js";
import { Badge, Button, Card, PageHeader } from "../../components/ui.js";

function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Brave/.test(userAgent)
      ? "Brave"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Firefox\//.test(userAgent)
          ? "Firefox"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Browser";
  const os = /Windows/.test(userAgent)
    ? "Windows"
    : /Mac OS X/.test(userAgent)
      ? "Mac"
      : /Android/.test(userAgent)
        ? "Android"
        : /iPhone|iPad/.test(userAgent)
          ? "iOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function formatRelativeTime(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AdminPage() {
  const { data: sessions, isLoading: sessionsLoading } = useActiveSessions();
  const { data: storage, isLoading: storageLoading } = useStorageStats();

  return (
    <div className="space-y-6">
      <PageHeader title="Admin" subtitle="Active sessions, storage usage, and a full data export." />

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Storage</h2>
        {storageLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <div className="flex gap-6">
            <div>
              <p className="text-2xl font-semibold text-slate-900">{storage?.fileCount ?? 0}</p>
              <p className="text-sm text-slate-500">files uploaded</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{formatBytes(storage?.totalBytes ?? 0)}</p>
              <p className="text-sm text-slate-500">total size</p>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Active sessions</h2>
        {sessionsLoading && <p className="text-sm text-slate-400">Loading…</p>}
        <ul className="divide-y divide-slate-100">
          {sessions?.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </ul>
        {sessions?.length === 0 && <p className="text-sm text-slate-400">No active sessions.</p>}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Export patient records</h2>
        <p className="mb-3 text-sm text-slate-500">
          Downloads every patient&apos;s profile, appointments, treatment notes, and invoices as a ZIP of CSV files.
          This is patient health data — handle the downloaded file carefully.
        </p>
        <a
          href={adminExportUrl()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-800"
        >
          Download all patient records (CSV)
        </a>
      </Card>
    </div>
  );
}

function SessionRow({ session }: { session: SessionSummary }) {
  const revokeSession = useRevokeSession();

  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div>
        <div className="flex items-center gap-2">
          <p className="font-medium text-slate-900">{session.staffName}</p>
          <Badge tone="slate">{session.staffRole === "doctor" ? "Doctor" : "Front desk"}</Badge>
          {session.isCurrent && <Badge tone="brand">This device</Badge>}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {describeDevice(session.userAgent)} · last active {formatRelativeTime(session.lastUsedAt ?? session.createdAt)}
        </p>
      </div>
      {!session.isCurrent && (
        <Button
          size="sm"
          variant="danger"
          onClick={() => revokeSession.mutate(session.id)}
          disabled={revokeSession.isPending}
        >
          Sign out
        </Button>
      )}
    </li>
  );
}
