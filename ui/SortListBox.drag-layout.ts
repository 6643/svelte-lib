export const resolveDragIndex = (
    initialIndex: number,
    deltaY: number,
    avgItemSize: number,
    itemCount: number,
): number => {
    if (avgItemSize <= 0 || itemCount <= 1) {
        return initialIndex;
    }

    const maxIndex = itemCount - 1;
    return Math.max(0, Math.min(initialIndex + Math.round(deltaY / avgItemSize), maxIndex));
};

export const getDragTranslateY = (
    initialIndex: number,
    currentIndex: number,
    index: number,
    avgItemSize: number,
): number => {
    if (avgItemSize <= 0 || index === initialIndex) {
        return 0;
    }

    if (initialIndex < currentIndex && index > initialIndex && index <= currentIndex) {
        return -avgItemSize;
    }

    if (initialIndex > currentIndex && index >= currentIndex && index < initialIndex) {
        return avgItemSize;
    }

    return 0;
};
