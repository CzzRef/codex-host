import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  HistoricalTurnOutcome,
  HostAgentMessageItem,
  HostItemSnapshot,
  HostThreadSnapshot,
  HostTurnSnapshot,
} from "@codexhost/harness-adapter";
import {
  hostItemIdSchema,
  nativeTurnRefSchema,
  type HarnessId,
  type NativeTurnRef,
} from "@codexhost/shared-contracts";

const USER_INFO_PREFIX = "<user_info>";

export interface CursorNativeMessage {
  readonly blobId: string;
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly nativeId?: string;
}

export interface CursorSessionLocation {
  readonly sessionId: string;
  readonly directory: string;
  readonly cwd?: string;
  readonly title?: string;
}

export function cursorHomeDir(environment: NodeJS.ProcessEnv = process.env): string {
  const home = environment.HOME ?? environment.USERPROFILE ?? os.homedir();
  return environment.CURSOR_HOME ?? path.join(home, ".cursor");
}

export function cursorSessionDirectory(
  sessionId: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return path.join(cursorHomeDir(environment), "acp-sessions", sessionId);
}

export async function locateCursorSession(
  sessionId: string,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<CursorSessionLocation | null> {
  const directory = cursorSessionDirectory(sessionId, environment);
  try {
    const meta = JSON.parse(await readFile(path.join(directory, "meta.json"), "utf8")) as {
      cwd?: unknown;
      title?: unknown;
    };
    return {
      sessionId,
      directory,
      ...(typeof meta.cwd === "string" ? { cwd: meta.cwd } : {}),
      ...(typeof meta.title === "string" ? { title: meta.title } : {}),
    };
  } catch {
    return null;
  }
}

function decodeVarint(data: Uint8Array, offset: number): { value: number; next: number } {
  let value = 0;
  let shift = 0;
  let index = offset;
  while (index < data.length) {
    const byte = data[index] ?? 0;
    index += 1;
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value, next: index };
    shift += 7;
    if (shift > 35) break;
  }
  throw new Error("Cursor session protobuf varint is truncated");
}

function decodeLengthDelimitedFields(
  data: Uint8Array,
): Array<{ field: number; bytes: Uint8Array }> {
  const fields: Array<{ field: number; bytes: Uint8Array }> = [];
  let offset = 0;
  while (offset < data.length) {
    const key = decodeVarint(data, offset);
    offset = key.next;
    const field = key.value >>> 3;
    const wire = key.value & 7;
    if (wire === 0) {
      offset = decodeVarint(data, offset).next;
      continue;
    }
    if (wire === 1) {
      offset += 8;
      continue;
    }
    if (wire === 5) {
      offset += 4;
      continue;
    }
    if (wire !== 2) break;
    const length = decodeVarint(data, offset);
    offset = length.next;
    fields.push({ field, bytes: data.subarray(offset, offset + length.value) });
    offset += length.value;
  }
  return fields;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (record(part) && part.type === "text" && typeof part.text === "string") return part.text;
      return "";
    })
    .join("");
}

function isSyntheticUserText(text: string): boolean {
  return text.trimStart().startsWith(USER_INFO_PREFIX);
}

function parseJsonMessage(blobId: string, data: Buffer): CursorNativeMessage | null {
  if (data[0] !== 0x7b) return null;
  try {
    const parsed: unknown = JSON.parse(data.toString("utf8"));
    if (!record(parsed)) return null;
    if (parsed.role !== "user" && parsed.role !== "assistant") return null;
    const text = messageText(parsed.content).trim();
    if (parsed.role === "user" && isSyntheticUserText(text)) return null;
    if (text.length === 0) return null;
    return {
      blobId,
      role: parsed.role,
      text,
      ...(typeof parsed.id === "string" && parsed.id.length > 0 ? { nativeId: parsed.id } : {}),
    };
  } catch {
    return null;
  }
}

function hexJson(value: string): Record<string, unknown> | null {
  try {
    const decoded = Buffer.from(value, "hex").toString("utf8");
    const parsed: unknown = JSON.parse(decoded);
    return record(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readCursorNativeMessages(directory: string): CursorNativeMessage[] {
  const storePath = path.join(directory, "store.db");
  let database: DatabaseSync;
  try {
    database = new DatabaseSync(storePath, { readOnly: true });
  } catch {
    return [];
  }
  try {
    const blobs = new Map<string, Buffer>();
    for (const row of database.prepare("SELECT id, data FROM blobs").all() as Array<{
      id: string;
      data: Uint8Array | Buffer | string;
    }>) {
      const data = typeof row.data === "string" ? Buffer.from(row.data) : Buffer.from(row.data);
      blobs.set(row.id, data);
    }
    const metaRow = database.prepare("SELECT value FROM meta WHERE key = '0'").get() as
      { value: string } | undefined;
    const meta = metaRow ? hexJson(metaRow.value) : null;
    const rootId = typeof meta?.latestRootBlobId === "string" ? meta.latestRootBlobId : undefined;
    const root = rootId ? blobs.get(rootId) : undefined;
    if (!root) {
      return [...blobs.entries()]
        .map(([blobId, data]) => parseJsonMessage(blobId, data))
        .filter((message): message is CursorNativeMessage => message !== null);
    }
    const ordered: CursorNativeMessage[] = [];
    for (const field of decodeLengthDelimitedFields(root)) {
      if (field.field !== 1 || field.bytes.byteLength !== 32) continue;
      const blobId = Buffer.from(field.bytes).toString("hex");
      const data = blobs.get(blobId);
      if (!data) continue;
      const message = parseJsonMessage(blobId, data);
      if (message) ordered.push(message);
    }
    return ordered;
  } finally {
    database.close();
  }
}

function stableItemId(kind: string, turn: number, index: number) {
  return hostItemIdSchema.parse(`cursor-history-${kind}-${turn}-${index}`);
}

function nativeTurnKey(message: CursorNativeMessage): string {
  return message.nativeId ?? message.blobId;
}

export function mapCursorHistory(
  messages: readonly CursorNativeMessage[],
  harnessId: HarnessId,
  sessionId: string,
  knownTurnRefs: readonly NativeTurnRef[] = [],
): HostThreadSnapshot {
  const knownByKey = new Map(
    knownTurnRefs
      .filter((ref) => ref.harnessId === harnessId && ref.nativeSessionId === sessionId)
      .map((ref) => [ref.nativeTurnKey, ref] as const),
  );
  const turns: HostTurnSnapshot[] = [];
  let pendingUser: CursorNativeMessage | undefined;
  let turnIndex = 0;

  const complete = (user: CursorNativeMessage, assistant?: CursorNativeMessage): void => {
    const reconstructedKey = assistant ? nativeTurnKey(assistant) : user.blobId;
    const known = knownByKey.get(reconstructedKey);
    const items: HostItemSnapshot[] = [];
    if (assistant) {
      const item: HostAgentMessageItem = {
        type: "agentMessage",
        itemId: stableItemId("message", turnIndex, 1),
        text: assistant.text,
      };
      items.push({ item, outcome: { status: "succeeded" } });
    }
    const outcome: HistoricalTurnOutcome = assistant
      ? { status: "succeeded" }
      : { status: "unknown", reason: "Cursor Native history has no assistant message" };
    turns.push({
      nativeTurnRef: nativeTurnRefSchema.parse({
        harnessId,
        nativeSessionId: sessionId,
        nativeTurnKey: known?.nativeTurnKey ?? reconstructedKey,
        formatVersion: 1,
      }),
      input: [{ type: "text", text: user.text }],
      items,
      outcome,
    });
    turnIndex += 1;
  };

  for (const message of messages) {
    if (message.role === "user") {
      if (pendingUser) complete(pendingUser);
      pendingUser = message;
      continue;
    }
    if (!pendingUser) continue;
    complete(pendingUser, message);
    pendingUser = undefined;
  }
  if (pendingUser) complete(pendingUser);
  return { turns };
}

export function cursorNativeTurnKeys(snapshot: HostThreadSnapshot): Set<string> {
  return new Set(snapshot.turns.map((turn) => turn.nativeTurnRef.nativeTurnKey));
}

export function latestCursorNativeTurn(
  snapshot: HostThreadSnapshot,
  previousKeys: ReadonlySet<string>,
): NativeTurnRef | undefined {
  for (let index = snapshot.turns.length - 1; index >= 0; index -= 1) {
    const turn = snapshot.turns[index];
    if (!turn) continue;
    if (!previousKeys.has(turn.nativeTurnRef.nativeTurnKey)) return turn.nativeTurnRef;
  }
  return snapshot.turns.at(-1)?.nativeTurnRef;
}

export function encodeCursorRoot(blobIds: readonly string[]): Buffer {
  const chunks: Buffer[] = [];
  for (const blobId of blobIds) {
    const hash = Buffer.from(blobId, "hex");
    const header = Buffer.from([0x0a, hash.length]);
    chunks.push(header, hash);
  }
  return Buffer.concat(chunks);
}

export function cursorBlobId(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function writeCursorSessionStore(
  directory: string,
  input: {
    sessionId: string;
    cwd?: string;
    title?: string;
    messages: ReadonlyArray<{
      role: "user" | "assistant" | "system";
      content: unknown;
      id?: string;
    }>;
  },
): void {
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, "meta.json"),
    JSON.stringify({
      schemaVersion: 1,
      ...(input.cwd ? { cwd: input.cwd } : {}),
      ...(input.title ? { title: input.title } : {}),
    }),
  );
  const blobs = new Map<string, Buffer>();
  const orderedIds: string[] = [];
  for (const message of input.messages) {
    const data = Buffer.from(JSON.stringify(message), "utf8");
    const blobId = cursorBlobId(data);
    blobs.set(blobId, data);
    orderedIds.push(blobId);
  }
  const root = encodeCursorRoot(orderedIds);
  const rootId = cursorBlobId(root);
  blobs.set(rootId, root);
  const storePath = path.join(directory, "store.db");
  const database = new DatabaseSync(storePath);
  try {
    database.exec(
      "CREATE TABLE blobs (id TEXT PRIMARY KEY, data BLOB); CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);",
    );
    const insert = database.prepare("INSERT INTO blobs (id, data) VALUES (?, ?)");
    for (const [id, data] of blobs) insert.run(id, data);
    const meta = Buffer.from(
      JSON.stringify({
        agentId: input.sessionId,
        latestRootBlobId: rootId,
        name: input.title ?? input.sessionId,
      }),
      "utf8",
    ).toString("hex");
    database.prepare("INSERT INTO meta (key, value) VALUES (?, ?)").run("0", meta);
  } finally {
    database.close();
  }
}
