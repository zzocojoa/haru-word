import LearningApp from "./learning-app";
import { today } from "@/lib/learning";
export const dynamic="force-dynamic";
export default function Home(){return <LearningApp initialDate={today()}/>}
