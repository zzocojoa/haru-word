/** A deliberate rightward swipe from the left edge; no vertical/leftward navigation. */
export const SWIPE_EDGE = 24;
export function swipeDirection(dx: number, dy: number): 'pending' | 'back' | 'cancel' {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return 'pending';
  return dx > 0 && dx > Math.abs(dy) * 1.5 ? 'back' : 'cancel';
}
export function completesSwipe(dx: number, dy: number, width: number) {
  return swipeDirection(dx, dy) === 'back' && dx >= Math.min(120, Math.max(72, width * .24));
}
