type VideoLike = { ended: boolean; paused: boolean; pause?: () => void };
type SlideLike<TVideo extends VideoLike = VideoLike> = {
    classList: { contains: (name: string) => boolean };
    querySelectorAll: (selector: string) => ArrayLike<TVideo> | Iterable<TVideo>;
};
type SwiperLike<TVideo extends VideoLike = VideoLike> = {
    autoplay?: { start?: () => void; stop?: () => void };
    params?: { autoplay?: { enabled?: boolean } };
    slides: SlideLike<TVideo>[];
};

const getSlideVideos = <TVideo extends VideoLike>(
    slide: SlideLike<TVideo>,
    cache: WeakMap<object, TVideo[]>,
): TVideo[] => {
    const cached = cache.get(slide as object);
    if (cached) {
        return cached;
    }

    const videos = Array.from(slide.querySelectorAll("video"));
    cache.set(slide as object, videos);
    return videos;
};

export const shouldAutoplayRun = (
    videos: Array<{ visible: boolean; paused: boolean; ended: boolean }>,
): boolean => !videos.some((video) => video.visible && !video.paused && !video.ended);

export const collectSwiperVideos = <TVideo extends VideoLike>(
    slides: SlideLike<TVideo>[],
    cache = new WeakMap<object, TVideo[]>(),
): Array<{ visible: boolean; paused: boolean; ended: boolean }> =>
    slides.flatMap((slide) =>
        getSlideVideos(slide, cache).map((video) => ({
            ended: video.ended,
            paused: video.paused,
            visible: slide.classList.contains("swiper-slide-visible"),
        })),
    );

export const pauseHiddenSwiperVideos = <TVideo extends VideoLike>(
    slides: SlideLike<TVideo>[],
    cache = new WeakMap<object, TVideo[]>(),
): void => {
    slides.forEach((slide) => {
        if (slide.classList.contains("swiper-slide-visible")) return;

        getSlideVideos(slide, cache).forEach((video) => {
            if (video.paused) return;
            video.pause?.();
        });
    });
};

export const syncSwiperVideoAutoplay = <TVideo extends VideoLike>(swiper: SwiperLike<TVideo>): void => {
    if (!swiper?.params?.autoplay?.enabled) return;

    const videoCache = new WeakMap<object, TVideo[]>();
    const videos = collectSwiperVideos(swiper.slides, videoCache);

    if (shouldAutoplayRun(videos)) {
        swiper.autoplay?.start?.();
        pauseHiddenSwiperVideos(swiper.slides, videoCache);
        return;
    }

    swiper.autoplay?.stop?.();
};
