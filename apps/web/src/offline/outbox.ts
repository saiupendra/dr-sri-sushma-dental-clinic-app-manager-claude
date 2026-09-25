import { get, set } from "idb-keyval";
import type { HttpMethod } from "../api/client.js";
import { apiRequest, NetworkError } from "../api/client.js";
import { outboxDbStore } from "./storage.js";

export interface OutboxItem {
  id: string;
  method: HttpMethod;
  path: string;
  body?: unknown;
  /** Human-readable label for the pending-sync list, e.g. "Patient: Asha Rao". */
  entityLabel: string;
  createdAt: string;
}

const OUTBOX_KEY = "queue";

async function readQueue(): Promise<OutboxItem[]> {
  return (await get<OutboxItem[]>(OUTBOX_KEY, outboxDbStore)) ?? [];
}

async function writeQueue(items: OutboxItem[]): Promise<void> {
  await set(OUTBOX_KEY, items, outboxDbStore);
}

export async function enqueue(item: Omit<OutboxItem, "id" | "createdAt">): Promise<OutboxItem> {
  const full: OutboxItem = { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  const queue = await readQueue();
  queue.push(full);
  await writeQueue(queue);
  return full;
}

export async function listOutbox(): Promise<OutboxItem[]> {
  return readQueue();
}

export interface FlushResult {
  succeeded: number;
  failed: number;
  stillOffline: boolean;
}

/**
 * Replays queued mutations against the API, in the order they were made
 * (last-write-wins: whatever the server has after replay is the new truth).
 * Stops at the first item that fails because we're still offline, leaving it
 * and everything after it queued for the next attempt. An item the server
 * actively rejects (a real validation/conflict error, not a connectivity
 * failure) is dropped rather than blocking the queue forever, and logged for
 * staff to investigate.
 */
export async function flushOutbox(): Promise<FlushResult> {
  const queue = await readQueue();
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i]!;
    try {
      await apiRequest(item.method, item.path, item.body);
      succeeded++;
    } catch (err) {
      if (err instanceof NetworkError) {
        await writeQueue(queue.slice(i));
        return { succeeded, failed, stillOffline: true };
      }
      console.error("Dropped a queued offline change the server rejected:", item, err);
      failed++;
    }
  }

  await writeQueue([]);
  return { succeeded, failed, stillOffline: false };
}
