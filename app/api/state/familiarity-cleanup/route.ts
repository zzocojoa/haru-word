import { json } from '@/lib/server/http';

// Older tabs may still submit this request after the test cleanup is retired.
export function POST() {
  return json({ error: '테스트 진행 정리 기능이 종료됐어요.' }, 410);
}
