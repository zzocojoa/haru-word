import LearningApp from "./learning-app";
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from './chatgpt-auth';
import { grammarV4Ready } from '@/lib/grammar/review';
export const dynamic="force-dynamic";
// This dynamic server component intentionally samples the server clock per request.
// eslint-disable-next-line react-hooks/purity
export default async function Home(){const user = await getChatGPTUser(); return <LearningApp userId={user?.userId ?? null} initialServerTime={Date.now()} imagePilotEnabled={process.env.NODE_ENV === 'development' || env.word_image_pilot_enabled === 'true'} grammarEnabled={env.grammar_enabled === 'true'} grammarPracticeEnabled={env.grammar_practice_v2_enabled === 'true'} grammarV3Enabled={env.grammar_practice_v3_enabled === 'true'} grammarV4Enabled={env.grammar_practice_v4_enabled === 'true' && await grammarV4Ready()}/>}
