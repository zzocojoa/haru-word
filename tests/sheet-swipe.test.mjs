import test from 'node:test';
import assert from 'node:assert/strict';
import { sheetSwipeDirection, completesSheetSwipe } from '../lib/sheet-swipe.ts';
test('downward intention excludes taps, upward and horizontal gestures', () => {
  assert.equal(sheetSwipeDirection(3, 9), 'pending');
  assert.equal(sheetSwipeDirection(5, 50), 'dismiss');
  for (const [x,y] of [[0,-120],[160,20],[-130,10],[80,80],[80,120]]) assert.equal(sheetSwipeDirection(x,y), 'cancel');
});
test('dismissal needs deliberate distance for short and tall sheets', () => {
  assert.equal(completesSheetSwipe(0,71,200), false);
  assert.equal(completesSheetSwipe(0,72,200), true);
  assert.equal(completesSheetSwipe(0,119,1000), false);
  assert.equal(completesSheetSwipe(0,120,1000), true);
  assert.equal(completesSheetSwipe(200,130,500), false);
});
