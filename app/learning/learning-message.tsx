"use client";
import {HaruIconButton} from '../haru-controls';
import { HaruIcon } from '@/components/icons/haru-icon';
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
      <HaruIconButton label="안내 닫기" className="learning-message-close" icon={<HaruIcon name="x" size={20}/>} onClick={onDismiss}/>
    </div>
  );
}
