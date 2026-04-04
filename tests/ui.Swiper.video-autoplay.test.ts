import { expect, test } from "bun:test";

import { collectSwiperVideos, shouldAutoplayRun, syncSwiperVideoAutoplay } from "../ui/Swiper.video-autoplay.ts";

test("shouldAutoplayRun stops autoplay when a visible video is playing", () => {
    expect(shouldAutoplayRun([{ visible: true, paused: false, ended: false }])).toBe(false);
});

test("collectSwiperVideos reuses cached video queries for the same slides", () => {
    let queryCount = 0;
    const sharedVideo = { ended: false, paused: true };
    const cache = new WeakMap<object, Array<typeof sharedVideo>>();
    const slide = {
        classList: { contains: (name: string) => name === "swiper-slide-visible" },
        querySelectorAll: () => {
            queryCount += 1;
            return [sharedVideo];
        },
    };

    const first = collectSwiperVideos([slide], cache);
    const second = collectSwiperVideos([slide], cache);

    expect(first).toEqual([{ ended: false, paused: true, visible: true }]);
    expect(second).toEqual(first);
    expect(queryCount).toBe(1);
});

test("syncSwiperVideoAutoplay reflects slide video changes across calls", () => {
    let autoplayStarts = 0;
    let autoplayStops = 0;
    let videos = [{ ended: false, paused: false }];
    const slide = {
        classList: {
            contains: (name: string) => name === "swiper-slide-visible",
        },
        querySelectorAll: () => videos,
    };
    const swiper = {
        autoplay: {
            start: () => {
                autoplayStarts += 1;
            },
            stop: () => {
                autoplayStops += 1;
            },
        },
        params: { autoplay: { enabled: true } },
        slides: [slide],
    };

    syncSwiperVideoAutoplay(swiper);
    expect(autoplayStops).toBe(1);

    videos = [];
    syncSwiperVideoAutoplay(swiper);
    expect(autoplayStarts).toBe(1);
});
