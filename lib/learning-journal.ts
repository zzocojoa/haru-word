import { KIND_TEXT, type Kind, type Session } from "./learning/model.ts";

export type JournalDay = {
  date: string;
  sessions: { session: Session; number: number }[];
};

/** Group by the saved study date, not the creation timestamp or browser timezone.
 * Number all attempts before filtering so the same attempt keeps its label.
 * Only the view is grouped: session objects and their scores remain untouched.
 */
export function groupJournalSessions(
  sessions: readonly Session[],
  kind: "all" | Kind = "all",
): JournalDay[] {
  const days = new Map<string, Session[]>();
  for (const session of sessions) {
    const day = days.get(session.date) || [];
    day.push(session);
    days.set(session.date, day);
  }
  return [...days].sort(([a], [b]) => b.localeCompare(a)).flatMap(([date, day]) => {
    const entries = day
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .map((session, index) => ({ session, number: index + 1 }))
      .filter(({ session }) => kind === "all" || session.kind === kind)
      .reverse();
    return entries.length ? [{ date, sessions: entries }] : [];
  });
}

export function journalSessionLabel(session: Session): string {
  if (session.kind !== "practice") return KIND_TEXT[session.kind];
  switch (session.practiceMode) {
    case "repeat": return "다시 학습";
    case "ko": return "뜻→영어 연습";
    case "sentence": return "문장 보완";
    case "known": return "아는 단어 점검";
    default: return KIND_TEXT.practice;
  }
}
