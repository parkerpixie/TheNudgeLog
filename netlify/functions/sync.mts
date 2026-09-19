import type { Context, Config } from "@netlify/functions";
import { getStore, getDeployStore } from "@netlify/blobs";

type Nudge = {
  id: string;
  person: string;
  type: string;
  requested: string;
  keptGoing: string;
  note?: string;
  createdAt: string;
};

type SyncPayload = {
  syncKey: string;
  entries?: Nudge[];
  deletedIds?: string[];
};

function getSyncStore(context: Context) {
  if (context.deploy?.context === "production") {
    return getStore("nudge-log-sync", { consistency: "strong" });
  }
  return getDeployStore("nudge-log-sync");
}

async function hashKey(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: SyncPayload;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const syncKey = String(payload.syncKey || "").trim();
  if (syncKey.length < 24) {
    return Response.json({ error: "Invalid sync key" }, { status: 400 });
  }

  const incomingEntries = Array.isArray(payload.entries) ? payload.entries : [];
  const incomingDeleted = Array.isArray(payload.deletedIds) ? payload.deletedIds : [];
  const objectKey = await hashKey(syncKey);
  const store = getSyncStore(context);

  const remote =
    (await store.get(objectKey, { type: "json" })) ||
    ({ entries: [], deletedIds: [] } as { entries: Nudge[]; deletedIds: string[] });

  const deleted = new Set<string>([
    ...(Array.isArray(remote.deletedIds) ? remote.deletedIds : []),
    ...incomingDeleted
  ]);

  const byId = new Map<string, Nudge>();
  for (const entry of [...(Array.isArray(remote.entries) ? remote.entries : []), ...incomingEntries]) {
    if (entry?.id && !deleted.has(entry.id)) byId.set(entry.id, entry);
  }

  const entries = Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const deletedIds = Array.from(deleted);

  const merged = {
    entries,
    deletedIds,
    updatedAt: new Date().toISOString()
  };

  await store.setJSON(objectKey, merged);

  return Response.json(merged, {
    headers: { "Cache-Control": "no-store" }
  });
};

export const config: Config = {
  path: "/api/sync"
};
