import LearningApp from "./learning-app";
import { env } from 'cloudflare:workers';
export const dynamic="force-dynamic";
// This dynamic server component intentionally samples the server clock per request.
// eslint-disable-next-line react-hooks/purity
export default function Home(){return <LearningApp initialServerTime={Date.now()} grammarEnabled={env.grammar_enabled === 'true'} grammarPracticeEnabled={env.grammar_practice_v2_enabled === 'true'} grammarV3Enabled={env.grammar_practice_v3_enabled === 'true'}/>}
