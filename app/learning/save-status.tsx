"use client";
import {Text} from '@astryxdesign/core/Text';
import {Spinner} from '@astryxdesign/core/Spinner';
import { HaruIcon } from "@/components/icons/haru-icon";
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
    <Text type="inherit" color="inherit"
      className="save-state haru-save-state"
      data-state={saving || loading ? "saving" : unsaved ? "error" : "saved"}
      role="status"
    >
      {loading || saving ? (
        <Spinner size="md" aria-hidden="true" />
      ) : (
        <HaruIcon
          name={unsaved ? "cloud-unsaved" : signedIn ? "cloud-saved" : "cloud"}
          size={16}
        />
      )}
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
    </Text>
  );
}
