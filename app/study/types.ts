import type { Session, State, Word } from "@/lib/learning";
export type StudySessionProps = {
  date: string;
  activityDate: () => string;
  currentState: { current: State };
  state: State;
  session: Session;
  words: Word[];
  save: (s: State) => Promise<boolean>;
  busy: boolean;
  saved: boolean;
  visible: boolean;
  onClose: () => void;
  onReview: (date: string) => void;
  onRepeat: (date: string) => void;
  registerLeave?: (handler: () => Promise<boolean>) => () => void;
};
