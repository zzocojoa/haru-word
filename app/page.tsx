import LearningApp from "./learning-app";
export const dynamic="force-dynamic";
// This dynamic server component intentionally samples the server clock per request.
// eslint-disable-next-line react-hooks/purity
export default function Home(){return <LearningApp initialServerTime={Date.now()}/>}
