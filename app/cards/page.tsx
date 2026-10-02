import { env } from 'cloudflare:workers';
import Link from 'next/link';
import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { isCardStudioOwner } from '@/lib/server/card-studio';
import './studio.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: '영어 카드 · 하루단어' };
export default async function CardStudio() {
  const user = await requireChatGPTUser('/cards');
  if (!isCardStudioOwner(env, user)) return <main className="card-studio-unavailable">
    <h1>나의 영어 카드</h1>
    <p>{env.card_studio_enabled === 'true' ? '본인 전용 작업실입니다. 연결한 계정으로 로그인해 주세요.' : '개인 영어 카드 연결을 준비하고 있습니다.'}</p>
    <Link href="/">하루단어로 돌아가기</Link>
  </main>;
  return <iframe className="card-studio-frame" src="/card-studio/index.html" title="하루단어 영어 카드 작업실" />;
}
