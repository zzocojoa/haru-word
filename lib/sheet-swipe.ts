/** Deliberate downward dismissal, independent of scroll and horizontal Back. */
export function sheetSwipeDirection(dx: number, dy: number): 'pending' | 'dismiss' | 'cancel' {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return 'pending';
  return dy > 0 && dy > Math.abs(dx) * 1.5 ? 'dismiss' : 'cancel';
}
export function completesSheetSwipe(dx: number, dy: number, height: number) {
  return sheetSwipeDirection(dx, dy) === 'dismiss' && dy >= Math.min(120, Math.max(72, height * .18));
}
