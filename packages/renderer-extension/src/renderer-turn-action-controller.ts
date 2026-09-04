import { hostThreadIdSchema } from "@codexhost/shared-contracts";

import { clearComposerEditor, insertComposerText } from "./renderer-composer-prompt-reuse.js";
import { turnKeyMatches } from "./renderer-conversation-files.js";
import type { RendererModelClient } from "./renderer-model-client.js";
import {
  nativeTurnButton,
  rollbackSupportFor,
  turnActionCopy,
  turnPromptText,
  turnsAfterKey,
  type EditMode,
  type TurnActionBlock,
  type TurnActionCopy,
  type TurnActionId,
  type TurnActionView,
} from "./renderer-turn-actions.js";

export interface TurnActionTarget {
  threadId: string;
  turnKey: string;
  turn: Element;
}

/**
 * Edit / Rollback / Redo for the Turn the header currently describes. Holds
 * the thread-level truth from `codexhost/thread/inspect` (owner, rollback
 * bits, Redo slot) and issues the Host RPCs; the DOM it needs is injected.
 */
export interface TurnActionController {
  setCurrent(target: TurnActionTarget | null): void;
  /**
   * Where a Turn sits in the Host's own Turn list, or `null` when the Host
   * publishes none (official Codex Threads) or does not know this key.
   */
  hostTurnPosition(turnKey: string): { index: number; count: number } | null;
  view(input: { chinese: boolean; blocked: TurnActionBlock | null }): TurnActionView;
  activate(id: TurnActionId): void;
  confirm(): void;
  cancel(): void;
  /** Re-reads the thread-level truth from the Host. */
  refresh(): Promise<void>;
  dispose(): void;
}

/**
 * Position of a Turn inside the Host's Turn list. Desktop virtualises long
 * transcripts, so a DOM-derived "Turn 1/3" can describe a 22-Turn Thread; the
 * Host list is the only honest denominator.
 */
export function hostTurnPositionOf(input: {
  currentKey: string;
  hostTurnIds: readonly string[] | null;
}): { index: number; count: number } | null {
  const ids = input.hostTurnIds;
  if (!ids || ids.length === 0) return null;
  const index = ids.findIndex(
    (id) => turnKeyMatches(input.currentKey, id) || turnKeyMatches(id, input.currentKey),
  );
  return index >= 0 ? { index, count: ids.length } : null;
}

/**
 * How many Turns follow the current one. The Host's Turn ids win when it
 * publishes them: Desktop virtualises long transcripts, so the DOM window can
 * omit trailing Turns and would under-count what a rollback drops.
 */
export function laterTurnCount(input: {
  currentKey: string;
  domKeys: readonly string[];
  hostTurnIds: readonly string[] | null;
}): number {
  if (input.hostTurnIds && input.hostTurnIds.length > 0) {
    const index = input.hostTurnIds.findIndex(
      (id) => turnKeyMatches(input.currentKey, id) || turnKeyMatches(id, input.currentKey),
    );
    if (index >= 0) return Math.max(0, input.hostTurnIds.length - index - 1);
  }
  return turnsAfterKey(input.domKeys, input.currentKey);
}

export function createTurnActionController(options: {
  getClient(): RendererModelClient | null;
  orderedTurnKeys(): readonly string[];
  composerEditor(): HTMLElement | null;
  nativeRedoButton(): HTMLButtonElement | null;
  chinese(): boolean;
  notify(text: string): void;
  onChange(): void;
  /** The Host replaced the Thread's history (rollback or Redo succeeded). */
  onHistoryReplaced?(): void;
}): TurnActionController {
  let current: TurnActionTarget | null = null;
  // Turn-keyed: this session rolled the Thread back to that Turn.
  let rolledBackKey: string | null = null;
  // Thread-scoped: Host reports a Redo slot for the current Thread.
  let redoAvailable = false;
  // Thread-scoped: Host-reported rollback ability (null = official / unknown).
  let rollbackCapability: { lastTurn: boolean; multiTurn: boolean } | null = null;
  // Thread-scoped: the Host's ordered Turn ids, when it publishes them.
  let hostTurnIds: readonly string[] | null = null;
  // Who owns the Thread. Official Desktop Redo is only a fallback for Codex-owned
  // Threads; an external Thread without a slot gets nothing.
  let owner: "external" | "official" | "unknown" = "unknown";
  let confirming: TurnActionId | null = null;
  let inspectedThreadId: string | null = null;
  let inflightThreadId: string | null = null;
  let inspectGeneration = 0;
  let disposed = false;

  const hostPosition = (turnKey: string): { index: number; count: number } | null =>
    hostTurnPositionOf({ currentKey: turnKey, hostTurnIds });

  const laterTurns = (): number =>
    current
      ? laterTurnCount({
          currentKey: current.turnKey,
          domKeys: options.orderedTurnKeys(),
          hostTurnIds,
        })
      : 0;

  const nativePencil = (): HTMLButtonElement | null =>
    current?.turn ? nativeTurnButton(current.turn, /edit message|编辑消息|^edit$|^编辑$/i) : null;

  /** Position of the current Turn: Host list first, transcript window otherwise. */
  const currentPosition = (): number => {
    const target = current;
    if (!target) return -1;
    const host = hostPosition(target.turnKey);
    if (host) return host.index;
    return options
      .orderedTurnKeys()
      .findIndex(
        (key) => turnKeyMatches(key, target.turnKey) || turnKeyMatches(target.turnKey, key),
      );
  };

  /**
   * Edit's real effect. Desktop's pencil keeps owning official Turns. Otherwise
   * Edit rolls the Thread back past this Turn so resending replaces it — the
   * Host always keeps the first Turn, and a `lastTurnOnly` Harness can only
   * drop one, so those cases fall back to appending.
   */
  const editModeNow = (): { mode: EditMode; reason?: "firstTurn" | "unsupported" } => {
    if (!current) return { mode: "append", reason: "unsupported" };
    if (nativePencil()) return { mode: "native" };
    if (currentPosition() <= 0) return { mode: "append", reason: "firstTurn" };
    const support = rollbackSupportFor(rollbackCapability);
    const drops = laterTurns() + 1;
    if (support === "none" || (support === "lastTurnOnly" && drops > 1))
      return { mode: "append", reason: "unsupported" };
    return { mode: "replace" };
  };

  const copyFor = (chinese: boolean): TurnActionCopy => {
    const edit = editModeNow();
    return turnActionCopy({
      chinese,
      rolledBack: current !== null && rolledBackKey === current.turnKey,
      laterTurns: laterTurns(),
      redoAvailable,
      rollbackSupport: rollbackSupportFor(rollbackCapability),
      editMode: edit.mode,
      ...(edit.reason ? { editAppendReason: edit.reason } : {}),
    });
  };

  const inspect = (): Promise<void> => {
    const target = current;
    if (!target) return Promise.resolve();
    const parsed = hostThreadIdSchema.safeParse(target.threadId);
    if (!parsed.success) return Promise.resolve();
    const request = options.getClient()?.inspectThread?.({ threadId: parsed.data });
    if (!request) return Promise.resolve();
    const generation = ++inspectGeneration;
    inflightThreadId = target.threadId;
    return request
      .then((inspection) => {
        if (disposed || generation !== inspectGeneration) return;
        inflightThreadId = null;
        if (current?.threadId !== target.threadId) return;
        inspectedThreadId = target.threadId;
        owner = inspection.owner === "external" ? "external" : "official";
        if (inspection.owner === "external") {
          redoAvailable = inspection.historyRedoAvailable === true;
          rollbackCapability = inspection.rollback ?? null;
          hostTurnIds = inspection.turnIds ?? null;
        } else {
          // Official Threads keep Desktop's own Redo stack; the local flag from a
          // rollback this session made is the only signal there is.
          rollbackCapability = null;
          hostTurnIds = null;
        }
        options.onChange();
      })
      .catch(() => {
        if (generation === inspectGeneration) inflightThreadId = null;
      });
  };

  /**
   * `inclusive` drops the current Turn as well, which is what "edit and resend"
   * means: without it the edited Turn survives and the resend is appended.
   */
  const runRollback = (input?: { inclusive?: boolean }): Promise<void> => {
    const target = current;
    const numTurns = laterTurns() + (input?.inclusive === true ? 1 : 0);
    if (!target || numTurns === 0) {
      if (target) rolledBackKey = target.turnKey;
      return Promise.resolve();
    }
    return (
      options.getClient()?.rollbackThread?.({ threadId: target.threadId, numTurns }) ??
      Promise.resolve()
    ).then(() => {
      rolledBackKey = target.turnKey;
      // Host stashes the dropped Session in its one Redo slot for any rollback
      // extent; the inspect that follows is the authority.
      redoAvailable = true;
      options.onHistoryReplaced?.();
      void inspect();
    });
  };

  /**
   * Prefers Desktop's own pencil (official Turns). Harness Turns rarely have
   * one, so the prompt is refilled into the Composer instead.
   */
  const clickEdit = (copy: TurnActionCopy, prompt?: string): void => {
    const turn = current?.turn ?? null;
    const pencil = prompt === undefined ? nativePencil() : null;
    if (pencil) {
      pencil.click();
      return;
    }
    const text = prompt ?? (turn ? turnPromptText(turn) : "");
    const editor = options.composerEditor();
    if (!editor || text.length === 0) {
      options.notify(copy.editFailedNotice);
      return;
    }
    clearComposerEditor(editor);
    insertComposerText(editor, text);
    editor.focus();
    options.notify(copy.editFallbackNotice);
  };

  const runRedo = (copy: TurnActionCopy): void => {
    const target = current;
    const restored = (): void => {
      rolledBackKey = null;
      redoAvailable = false;
      options.notify(copy.redoNotice);
      options.onHistoryReplaced?.();
      options.onChange();
      void inspect();
    };
    // Official Desktop Redo is an app-action stack, not a conversation
    // restore. It is only a fallback for Threads Codex itself owns.
    const fallback = (): void => {
      const official = owner !== "external" ? options.nativeRedoButton() : null;
      official?.click();
      options.notify(official ? copy.redoOfficialFallbackNotice : copy.redoUnavailableNotice);
      options.onChange();
      void inspect();
    };
    const request = target
      ? options.getClient()?.redoThread?.({ threadId: target.threadId })
      : undefined;
    if (!request) {
      fallback();
      return;
    }
    void request.then(restored).catch(fallback);
  };

  return {
    hostTurnPosition: hostPosition,
    setCurrent(target) {
      const previous = current;
      current = target;
      const sameTurn =
        previous !== null &&
        target !== null &&
        previous.threadId === target.threadId &&
        previous.turnKey === target.turnKey;
      if (sameTurn) return;
      confirming = null;
      if (previous?.threadId !== target?.threadId) {
        rolledBackKey = null;
        redoAvailable = false;
        rollbackCapability = null;
        hostTurnIds = null;
        owner = "unknown";
        inspectedThreadId = null;
      }
      options.onChange();
      if (target && inspectedThreadId !== target.threadId && inflightThreadId !== target.threadId) {
        void inspect();
      }
    },
    view(input) {
      return { copy: copyFor(input.chinese), confirming, blocked: input.blocked };
    },
    activate(id) {
      if (!current) return;
      const copy = copyFor(options.chinese());
      if (confirming === id) {
        confirming = null;
        options.onChange();
        return;
      }
      if (id === "edit" && !copy.editNeedsConfirm) {
        clickEdit(copy);
        return;
      }
      if (id === "rollback" && copy.rollbackDisabled) return;
      if (id === "redo" && copy.redoDisabled) return;
      confirming = id;
      options.onChange();
    },
    confirm() {
      const pending = confirming;
      confirming = null;
      const copy = copyFor(options.chinese());
      if (pending === "edit") {
        const inclusive = editModeNow().mode === "replace";
        // Read the prompt before the rollback: an inclusive rollback may take
        // the Turn's nodes with it on a paginated transcript.
        const prompt = current?.turn ? turnPromptText(current.turn) : "";
        void runRollback({ inclusive }).then(() => {
          options.notify(copy.editNotice);
          clickEdit(copy, inclusive ? prompt : undefined);
          options.onChange();
        });
      } else if (pending === "rollback") {
        void runRollback().then(() => {
          options.notify(copy.rollbackNotice);
          options.onChange();
        });
      } else if (pending === "redo") {
        runRedo(copy);
      }
      options.onChange();
    },
    cancel() {
      if (confirming === null) return;
      confirming = null;
      options.onChange();
    },
    refresh() {
      return inspect();
    },
    dispose() {
      disposed = true;
      current = null;
    },
  };
}
