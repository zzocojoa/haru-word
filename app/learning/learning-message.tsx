"use client";
import { X } from 'lucide-react';
import { useLearningMessageLifetime } from './use-learning-message';

type MessageContentProps = { message: string; onDismiss: () => void };
type LearningMessageProps = MessageContentProps & { messageId: number };

/** Transient learning feedback only; save errors and recovery controls stay persistent. */
export function LearningMessage({ messageId, ...content }: LearningMessageProps) {
  // Keep repeated-message resets inside this component, not its callers.
  return <MessageContent key={messageId} {...content} />;
}

function MessageContent({ message, onDismiss }: MessageContentProps) {
  const readingInteractions = useLearningMessageLifetime(onDismiss);
  return (
    <div className="notice learning-message" {...readingInteractions}>
      <p role="status" aria-atomic="true">{message}</p>
      <button type="button" className="learning-message-close" aria-label="안내 닫기" onClick={onDismiss}>
        <X size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
