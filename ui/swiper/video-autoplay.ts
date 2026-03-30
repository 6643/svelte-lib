export const shouldAutoplayRun = (
    videos: Array<{ visible: boolean; paused: boolean; ended: boolean }>,
): boolean => !videos.some((video) => video.visible && !video.paused && !video.ended);
