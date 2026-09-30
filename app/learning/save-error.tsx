"use client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { download } from "../ui";
import type { LearningViewProps } from "./types";
import { DiagnosticDownload } from "./diagnostic-download";
import { useId } from 'react';
import { useNavigationState } from '../navigation';
import { useStudyRecoverySnapshot } from '../study/study-recovery';
type SaveErrorProps = Pick<
  LearningViewProps,
  "saveError" | "error" | "conflict" | "saving" | "unsaved" | "store" | "state"
>;
export function SaveError({
  saveError,
  error,
  conflict,
  saving,
  unsaved,
  store,
  state,
}: SaveErrorProps) {
  const id = useId();
  const recoverySnapshot = useStudyRecoverySnapshot();
  const [confirm, setConfirm] = useNavigationState(`reload.${id}`, false, true);
  return (
    <div ref={saveError} className="error-banner" role="alert">
      <p>{error}</p>
      <div className="button-row">
        {!conflict && (
          <button
            className="secondary-button"
            disabled={saving}
            onClick={() => (unsaved ? store.retry() : store.load())}
          >
            다시 시도
          </button>
        )}
        {unsaved && (
          <button
            className="text-button"
            onClick={() =>
              download(
                "haru-unsaved-backup.json",
                JSON.stringify(recoverySnapshot(state)),
              )
            }
          >
            현재 입력 백업
          </button>
        )}
        {conflict && (
          <AlertDialog open={confirm} onOpenChange={setConfirm}>
            <AlertDialogTrigger asChild>
              <button className="secondary-button">최신 기록 불러오기</button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  서버의 최신 기록을 불러올까요?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  저장하지 못한 현재 변경 내용은 교체됩니다. 필요한 입력은 먼저
                  백업하세요.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    void store.load();
                  }}
                >
                  최신 기록 불러오기
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <DiagnosticDownload />
      </div>
    </div>
  );
}
