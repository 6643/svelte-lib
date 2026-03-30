export const reorderItems = <T>(items: T[], from: number, to: number): T[] => {
    const nextItems = [...items];
    const [movedItem] = nextItems.splice(from, 1);
    nextItems.splice(to, 0, movedItem);
    return nextItems;
};
