"use client";
import { Cloud, Loader2 } from "lucide-react";
import type { LearningViewProps } from "./types";
type SaveStatusProps = Pick<
  LearningViewProps,
  "unsaved" | "saving" | "loading" | "signedIn"
>;
export function SaveStatus({
  unsaved,
  saving,
  loading,
  signedIn,
}: SaveStatusProps) {
  return (
    <span
      className="save-state"
      data-state={saving || loading ? "saving" : unsaved ? "error" : "saved"}
      role="status"
    >
      {saving ? <Loader2 size={15} className="spin" /> : <Cloud size={16} />}
      <span>
        {loading
          ? "기록 불러오는 중"
          : saving
            ? "저장 중"
            : unsaved
              ? "아직 저장되지 않음"
              : signedIn
                ? "저장됨"
                : "로그인 전"}
      </span>
    </span>
  );
}
