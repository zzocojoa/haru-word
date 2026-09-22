"use client";
import { hasReviewWork, type State } from "@/lib/learning";
import { useEffect } from "react";
import type { View } from "./types";
// Tools expose saved metadata only; all mutations still use the normal UI/store path.
export function useLearningTools(
  currentState: { current: State },
  setTab: (view: View) => void,
  currentStudyDate: () => string,
) {
  useEffect(() => {
    type Context = {
      registerTool: (
        tool: {
          name: string;
          description: string;
          inputSchema: object;
          annotations: object;
          execute: (input: unknown) => unknown;
        },
        options: { signal: AbortSignal },
      ) => void | Promise<void>;
    };
    const context = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<Context["registerTool"]>[0]) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => console.warn("Learning tool unavailable"));
      } catch {
        console.warn("Learning tool unavailable");
      }
    };
    register({
      name: "get_learning_summary",
      description:
        "Read the saved learning counts and current level. Does not grade or complete items.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => {
        const s = currentState.current;
        return {
          level: s.settings.level,
          dailyGoal: s.settings.dailyGoal,
          learned: Object.values(s.progress).filter((p) => p.lastStudied)
            .length,
          carryover: Object.values(s.progress).filter((p) => hasReviewWork(p))
            .length,
          activeSessionId: s.settings.activeSessionId,
          studyDate: currentStudyDate(),
          sessions: Object.values(s.sessions).map((x) => ({
            id: x.id,
            kind: x.kind,
            date: x.date,
            createdAt: x.createdAt,
            finished: x.finished,
            count: x.ids.length,
          })),
        };
      },
    });
    register({
      name: "show_learning_view",
      description:
        "Navigate to a study view. Does not start or complete learning.",
      inputSchema: {
        type: "object",
        properties: {
          view: { type: "string", enum: ["today", "library", "review", "log"] },
        },
        required: ["view"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        if (
          !input ||
          typeof input !== "object" ||
          Object.keys(input).length !== 1 ||
          !("view" in input) ||
          !["today", "library", "review", "log"].includes(String(input.view))
        )
          throw new Error("Invalid view");
        setTab(input.view as View);
        return { view: input.view, completed: false };
      },
    });
    return () => lifecycle.abort();
  }, [currentState, setTab, currentStudyDate]);
}
