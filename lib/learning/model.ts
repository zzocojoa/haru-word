import type { SentenceFeedback } from "../sentence-feedback";
import type { GrammarState } from '../grammar/model';

export const LEVELS = ["A1", "A2", "B1", "B2"] as const;

export const MAX_DAILY_GOAL = 10;

export type Level = (typeof LEVELS)[number];

export type Familiarity = "known" | "uncertain" | "new";

export type FamiliarityCheck = {
  initial: Familiarity;
  answer: string;
  meaning: string;
  final?: Familiarity;
};

export type Result = "independent" | "help" | "unmeasured";

export type SentenceResult = "written" | "improve" | "unmeasured";

export type Stage =
  | "warmup"
  | "learn"
  | "en"
  | "ko"
  | "sentence"
  | "checkpoint"
  | "done";

export type Kind = "daily" | "weekly" | "monthly" | "practice";

export type PracticeMode = "known" | "ko" | "sentence" | "repeat";

export type Word = {
  id: string;
  word: string;
  headword: string;
  pos: string;
  level: Level;
  page: number;
  personal?: boolean;
};

export type Content = {
  meaning: string;
  ipa?: string;
  expression: string;
  expressionTranslation?: string;
  example: string;
  translation: string;
  source: string;
  attribution?: string;
  url?: string;
};

export type Progress = {
  senses?: Record<string, SenseProgress>;
  familiarity?: Familiarity;
  familiarityCheck?: FamiliarityCheck;
  meaning?: string;
  expression?: string;
  expressionTranslation?: string;
  example?: string;
  translation?: string;
  en?: Result;
  ko?: Result;
  sentenceStatus?: SentenceResult;
  sentence?: string;
  notes?: string;
  studyDates?: string[];
  lastStudied?: string;
  needsReview?: boolean;
  personal?: Word;
  useful?: boolean;
  lastReviewed?: string;
  encounters?: {
    date: string;
    source: "reading" | "listening";
    text: string;
  }[];
};

export type SenseProgress = Pick<
  Progress,
  | "meaning"
  | "expression"
  | "expressionTranslation"
  | "example"
  | "translation"
  | "en"
  | "ko"
  | "sentenceStatus"
  | "sentence"
  | "notes"
  | "studyDates"
  | "lastStudied"
  | "lastReviewed"
  | "needsReview"
>;

export type Assessment = {
  ids: string[];
  index: number;
  marks: Record<string, Familiarity>;
  completed: boolean;
};

export type Settings = {
  level: Level;
  dailyGoal: number;
  assessments: Partial<Record<Level, Assessment>>;
  activeSessionId: string | null;
  newWordsPaused?: boolean;
  monthlyBatchSize?: number;
  reviewDay?: number;
};

export type DailyOrigin = 'new' | 'returning';

export type RecordItem = {
  entryId?: string;
  dailyOrigin?: DailyOrigin;
  learnedOn?: string;
  lastPracticedOn?: string;
  material?: Content;
  historicalMeaningUnknown?: boolean;
  aiFeedback?: SentenceFeedback;
  meaning: string;
  familiarity?: Familiarity;
  en: Result;
  ko: Result;
  sentenceStatus: SentenceResult;
  sentence: string;
  notes: string;
  spoken?: boolean;
  enAnswer?: string;
  koAnswer?: string;
  hintEn?: boolean;
  hintKo?: boolean;
  retryEn?: Result;
  retryKo?: Result;
  draft?: {
    answer: string;
    hinted: boolean;
    revealed: boolean;
    stage: "en" | "ko";
    retry: boolean;
  };
};

export type Session = {
  id: string;
  kind: Kind;
  date: string;
  period: string;
  ids: string[];
  wordKeys?: Record<string, string>;
  warmupIds: string[];
  warmupResults?: Record<string, Result>;
  warmupDraft?: {
    id: string;
    answer: string;
    hinted: boolean;
    revealed: boolean;
  };
  stage: Stage;
  index: number;
  records: Record<string, RecordItem>;
  retry: { id: string; direction: "en" | "ko"; seen?: string[] }[];
  retryMode: boolean;
  resumeAfterRetry?: { stage: Stage; index: number };
  batchSize?: number;
  batchStart?: number;
  reviewEnd?: number;
  practiceMode?: PracticeMode;
  elapsed: number;
  finished: boolean;
  paused: boolean;
  createdAt: string;
};

export type State = {
  grammar?: GrammarState;
  settings: Settings;
  progress: Record<string, Progress>;
  sessions: Record<string, Session>;
};

export const EMPTY: State = {
  settings: {
    level: "A1",
    dailyGoal: 3,
    assessments: {},
    activeSessionId: null,
  },
  progress: {},
  sessions: {},
};

export const RESULT_TEXT: Record<Result, string> = {
  independent: "독립 성공",
  help: "도움 필요",
  unmeasured: "미측정",
};

export const FAMILIARITY_TEXT: Record<Familiarity, string> = {
  known: "뜻을 알아요",
  uncertain: "조금 헷갈려요",
  new: "처음 봐요",
};

export const POS: Record<string, string> = {
  "n.": "명사",
  "v.": "동사",
  "adj.": "형용사",
  "adv.": "부사",
  "prep.": "전치사",
  "pron.": "대명사",
  "det.": "한정사",
  "conj.": "접속사",
  "exclam.": "감탄사",
  "modal v.": "법조동사",
  "auxiliary v.": "기본 조동사",
  number: "수사",
  "indefinite article": "부정관사",
  "definite article": "정관사",
  "infinitive marker": "부정사 표지",
};

export const SENTENCE_TEXT: Record<SentenceResult, string> = {
  written: "작성",
  improve: "보완 필요",
  unmeasured: "미측정",
};

export const KIND_TEXT: Record<Kind, string> = {
  daily: "일일 학습",
  weekly: "주간 점검",
  monthly: "월말 쓰기",
  practice: "보완 연습",
};

export type LearningTarget = {
  entryId: string;
  meaning: string;
  familiarity?: Familiarity;
  material?: Content;
  historicalMeaningUnknown?: boolean;
};
