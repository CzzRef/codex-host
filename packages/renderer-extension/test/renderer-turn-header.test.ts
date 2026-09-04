import { describe, expect, it } from "vitest";

import {
  CURRENT_TURN_PROBE,
  promptPinned,
  resolveCurrentTurn,
  scrollDeltaToTurn,
  transcriptTopReserve,
  turnHeaderBox,
} from "../src/renderer-overlay-layout.js";

describe("Turn header geometry", () => {
  it("pins the header to the transcript top below Desktop chrome, spanning the Composer column", () => {
    // Live shape: scroller spans the window, title chrome overlays its top.
    expect(
      turnHeaderBox({
        anchor: { left: 846, right: 1582 },
        scrollerTop: 0,
        chromeBottom: 52,
        composerTop: 837,
        viewportWidth: 2151,
        height: 68,
      }),
    ).toEqual({ left: 846, top: 52, width: 736 });
    // No chrome: the scroller's own top edge.
    expect(
      turnHeaderBox({
        anchor: { left: 40, right: 520 },
        scrollerTop: 44,
        chromeBottom: null,
        composerTop: 640,
        viewportWidth: 900,
        height: 68,
      }),
    ).toEqual({ left: 40, top: 44, width: 480 });
    // The viewport clamps the right edge.
    expect(
      turnHeaderBox({
        anchor: { left: 0, right: 1000 },
        scrollerTop: 0,
        chromeBottom: null,
        composerTop: 640,
        viewportWidth: 900,
        height: 68,
      }),
    ).toEqual({ left: 8, top: 0, width: 884 });
    // Too narrow, or no vertical room above the Composer: nothing to mount.
    expect(
      turnHeaderBox({
        anchor: { left: 40, right: 260 },
        scrollerTop: 0,
        chromeBottom: null,
        composerTop: 640,
        viewportWidth: 900,
        height: 68,
      }),
    ).toBeNull();
    expect(
      turnHeaderBox({
        anchor: { left: 40, right: 520 },
        scrollerTop: 0,
        chromeBottom: 600,
        composerTop: 640,
        viewportWidth: 900,
        height: 68,
      }),
    ).toBeNull();
  });

  it("resolves the current Turn from Turn edges with hysteresis", () => {
    const at =
      (tops: number[]) =>
      (index: number): number =>
        tops[index] ?? Number.NaN;
    const resolve = (tops: number[], previous: number | null, atBottom = false): number | null =>
      resolveCurrentTurn({
        count: tops.length,
        topAt: at(tops),
        atBottom,
        headerBottom: 120,
        previous,
      });
    // The probe line sits `CURRENT_TURN_PROBE` below the header's bottom edge.
    const line = 120 + CURRENT_TURN_PROBE;
    expect(resolve([], null)).toBeNull();
    // Transcript end in view: always the last Turn.
    expect(resolve([-500, 200, 900], null, true)).toBe(2);
    // Probe line inside the first Turn (second starts below it).
    expect(resolve([-500, 200, 900], null)).toBe(0);
    // Probe line inside the second Turn.
    expect(resolve([-500, 100, 900], null)).toBe(1);
    // Scrolled to the top: every Turn starts below the line → first Turn.
    expect(resolve([200, 600, 900], null)).toBe(0);
    // Jumping several Turns at once.
    expect(resolve([-900, -700, -300, 50, 700], 0)).toBe(3);
    // Entering: the next Turn must pass 6px under the line before it takes over.
    expect(resolve([-500, line - 4, 900], 0)).toBe(0);
    expect(resolve([-500, line - 20, 900], 0)).toBe(1);
    // Leaving: the current Turn keeps the header until it is 6px clear again.
    expect(resolve([-500, line + 4, 900], 1)).toBe(1);
    expect(resolve([-500, line + 16, 900], 1)).toBe(0);
    // Sub-pixel jitter around the boundary never flaps.
    let previous: number | null = 0;
    const seen: Array<number | null> = [];
    for (const top of [line - 3, line + 3, line - 3, line + 3, line - 3]) {
      previous = resolve([-500, top, 900], previous);
      seen.push(previous);
    }
    expect(seen).toEqual([0, 0, 0, 0, 0]);
    // A rollback shortened the transcript: a stale index is ignored.
    expect(resolve([-500, 100], 5)).toBe(1);
  });

  it("keeps a Turn the header scrolled to as the current Turn", () => {
    // The prompt button and the step arrows land a Turn `scrollDeltaToTurn`'s
    // gap under the header. Resolving that back to the previous Turn is what
    // made `›` look dead: the index refused to follow the scroll.
    const headerBottom = 120;
    const gap = -scrollDeltaToTurn({ turnTop: headerBottom, headerBottom });
    expect(gap).toBeLessThan(CURRENT_TURN_PROBE);
    const landed = headerBottom + gap;
    const at =
      (tops: number[]) =>
      (index: number): number =>
        tops[index] ?? Number.NaN;
    const resolve = (tops: number[], previous: number | null): number | null =>
      resolveCurrentTurn({
        count: tops.length,
        topAt: at(tops),
        atBottom: false,
        headerBottom,
        previous,
      });
    // Stepping forward from Turn 1 to Turn 2.
    expect(resolve([-900, landed, 900], 0)).toBe(1);
    // Clicking the prompt while already on Turn 2 keeps Turn 2.
    expect(resolve([-900, landed, 900], 1)).toBe(1);
    // Stepping back from Turn 3 to Turn 2.
    expect(resolve([-900, landed, 900], 2)).toBe(1);
  });

  it("repeats the prompt only once its bubble has left the viewport", () => {
    // Desktop's app-shell header is transparent, so the boundary is the
    // scroller's top edge: a bubble above the pinned header but inside that
    // band is still readable and a header copy would duplicate it.
    expect(promptPinned({ promptBottom: -10, viewportTop: 0, previous: false })).toBe(true);
    expect(promptPinned({ promptBottom: 30, viewportTop: 0, previous: false })).toBe(false);
    // Under the header but still inside the transparent chrome band.
    expect(promptPinned({ promptBottom: 44, viewportTop: 0, previous: false })).toBe(false);
    // Already pinned: a few pixels of re-entry do not unpin it.
    expect(promptPinned({ promptBottom: 6, viewportTop: 0, previous: true })).toBe(true);
    expect(promptPinned({ promptBottom: 12, viewportTop: 0, previous: true })).toBe(false);
  });

  it("reserves transcript space without shrinking Desktop's own spacing", () => {
    expect(transcriptTopReserve({ need: 128, spacers: 0, basePaddingTop: 24 })).toBe(128);
    // Desktop already leaves 77px before the first Turn: only the rest is added.
    expect(transcriptTopReserve({ need: 128, spacers: 77, basePaddingTop: 0 })).toBe(51);
    // A larger native padding is never reduced.
    expect(transcriptTopReserve({ need: 40, spacers: 0, basePaddingTop: 77 })).toBe(77);
    expect(transcriptTopReserve({ need: 40, spacers: 60, basePaddingTop: 0 })).toBe(0);
    expect(scrollDeltaToTurn({ turnTop: 400, headerBottom: 120 })).toBe(272);
    expect(scrollDeltaToTurn({ turnTop: 100, headerBottom: 120, gap: 0 })).toBe(-20);
  });
});
