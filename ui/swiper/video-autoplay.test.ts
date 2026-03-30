import { expect, test } from "bun:test";

import { shouldAutoplayRun } from "./video-autoplay.ts";

test("shouldAutoplayRun stops autoplay when a visible video is playing", () => {
    expect(shouldAutoplayRun([{ visible: true, paused: false, ended: false }])).toBe(false);
});
