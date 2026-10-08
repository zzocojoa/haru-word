import type { RelaySiteConfig } from './card-automation.generated.mjs';
export type ValidationConfig = RelaySiteConfig & {
  topic_sentence_validation_key?: string;
  topic_sentence_validation_expires?: string;
};
export function handleTopicSentenceValidation(request: Request, config: ValidationConfig,
  transport?: typeof fetch, clock?: () => number): Promise<Response>;
