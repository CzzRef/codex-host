import { describe, expect, it } from "vitest";

import {
  CODEX_PINNED_THREAD_SECTION_ID,
  decodeHostThreadListCursor,
  decodeOfficialThreadListPage,
  decodeThreadArchiveRequest,
  decodeThreadListRequest,
  decodeThreadMetadataUpdateRequest,
  decodeThreadSectionMoveRequest,
  encodeHostThreadListCursor,
} from "../src/index.js";

describe("Codex Thread list and management protocol boundary", () => {
  it("decodes and normalizes the current thread/list fields", () => {
    const decoded = decodeThreadListRequest({
      id: 1,
      method: "thread/list",
      params: {
        archived: true,
        cwd: ["/one", "/two"],
        isPinned: false,
        limit: 250,
        modelProviders: ["codexhost"],
        searchTerm: "Title",
        sortDirection: "asc",
        sortKey: "recency_at",
        sourceKinds: ["vscode"],
        useStateDbOnly: true,
      },
    });
    expect(decoded).toMatchObject({
      archived: true,
      cwd: ["/one", "/two"],
      isPinned: false,
      limit: 100,
      sortDirection: "asc",
      sortKey: "recency_at",
      supportsExternal: true,
    });
    expect(decoded?.queryFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(decoded?.sectionFilter).toEqual({ kind: "any" });
  });

  it("decodes section list filters and section_position sort", () => {
    expect(
      decodeThreadListRequest({
        id: 1,
        method: "thread/list",
        params: {
          sectionId: CODEX_PINNED_THREAD_SECTION_ID,
          sortKey: "section_position",
          modelProviders: [],
          useStateDbOnly: true,
        },
      }),
    ).toMatchObject({
      sectionFilter: { kind: "id", sectionId: CODEX_PINNED_THREAD_SECTION_ID },
      sortKey: "section_position",
      sortDirection: "asc",
      supportsExternal: true,
    });
    expect(
      decodeThreadListRequest({
        id: 2,
        method: "thread/list",
        params: { sectionId: null },
      })?.sectionFilter,
    ).toEqual({ kind: "unsectioned" });
  });

  it("rejects malformed list fields and conflicting relationships", () => {
    expect(() =>
      decodeThreadListRequest({
        id: 1,
        method: "thread/list",
        params: { limit: -1 },
      }),
    ).toThrow("uint32");
    expect(() =>
      decodeThreadListRequest({
        id: 2,
        method: "thread/list",
        params: { sourceKinds: ["future-source"] },
      }),
    ).toThrow("unsupported value");
    expect(() =>
      decodeThreadListRequest({
        id: 3,
        method: "thread/list",
        params: { parentThreadId: "parent", ancestorThreadId: "ancestor" },
      }),
    ).toThrow("cannot combine");
  });

  it("omits External aggregation for future filters and legacy official cursors", () => {
    expect(
      decodeThreadListRequest({
        id: 1,
        method: "thread/list",
        params: { futureFilter: true },
      })?.supportsExternal,
    ).toBe(false);
    expect(
      decodeThreadListRequest({
        id: 2,
        method: "thread/list",
        params: { cursor: "official-opaque" },
      })?.supportsExternal,
    ).toBe(false);
  });

  it("round-trips a bounded Host cursor and binds query plus direction", () => {
    const decoded = decodeThreadListRequest({
      id: 1,
      method: "thread/list",
      params: { archived: false, sortDirection: "desc" },
    });
    if (!decoded) throw new Error("Expected thread/list decoding");
    const encoded = encodeHostThreadListCursor({
      queryFingerprint: decoded.queryFingerprint,
      sortDirection: decoded.sortDirection,
      officialCursor: "official-next",
      officialDone: false,
      externalAnchor: { timestamp: 100, threadId: "external-1" },
      externalDone: false,
    });
    expect(
      decodeHostThreadListCursor(encoded, {
        queryFingerprint: decoded.queryFingerprint,
        sortDirection: "desc",
      }),
    ).toMatchObject({
      officialCursor: "official-next",
      externalAnchor: { threadId: "external-1" },
    });
    expect(() =>
      decodeHostThreadListCursor(encoded, {
        queryFingerprint: decoded.queryFingerprint,
        sortDirection: "asc",
      }),
    ).toThrow("does not match");
    expect(() =>
      decodeHostThreadListCursor(encoded, {
        queryFingerprint: "0".repeat(64),
        sortDirection: "desc",
      }),
    ).toThrow("does not match");
  });

  it("decodes archive and metadata update targets without generic forwarding semantics", () => {
    expect(
      decodeThreadArchiveRequest({
        id: 1,
        method: "thread/archive",
        params: { threadId: "thread-1" },
      }),
    ).toEqual({ threadId: "thread-1" });
    expect(
      decodeThreadMetadataUpdateRequest({
        id: 2,
        method: "thread/metadata/update",
        params: {
          threadId: "thread-1",
          isPinned: true,
          gitInfo: { branch: "main", sha: null },
        },
      }),
    ).toEqual({
      threadId: "thread-1",
      isPinned: true,
      gitInfo: { branch: "main", sha: null },
    });
    expect(
      decodeThreadSectionMoveRequest({
        id: 3,
        method: "thread/section/move",
        params: {
          threadId: "thread-1",
          sectionId: CODEX_PINNED_THREAD_SECTION_ID,
          beforeThreadId: null,
        },
      }),
    ).toEqual({
      threadId: "thread-1",
      sectionId: CODEX_PINNED_THREAD_SECTION_ID,
      beforeThreadId: null,
    });
  });

  it("validates official thread/list pages without interpreting Thread content", () => {
    expect(
      decodeOfficialThreadListPage({
        data: [{ id: "official", createdAt: 1 }],
        nextCursor: "next",
        backwardsCursor: null,
      }),
    ).toEqual({
      data: [{ id: "official", createdAt: 1 }],
      nextCursor: "next",
      backwardsCursor: null,
    });
    expect(() => decodeOfficialThreadListPage({ data: [null] })).toThrow("invalid");
  });
});
