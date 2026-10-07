import { useState } from "react";

import AgentRunBlock from "@/components/conversation/agent-run-block";
import MessageBubble from "@/components/conversation/message-bubble";
import StepDetailDialog from "@/components/conversation/step-detail-dialog";
import {
  ErrorBlock,
  RunningBlock,
  TaskStatusCard,
  TimelineEmptyState,
  TimelineLoadingState,
} from "@/components/conversation/timeline-state";
import { buildAgentRunViewModel } from "@/components/conversation/view-model";
import type { PlanStepView } from "@/components/conversation/types";
import type { AgentPlan } from "@/types/planner";
import type { LoadState, SessionEventItem, AgentTaskItem, ChatMessage } from "@/types/sessions";
import useAutoScroll from "@/hooks/use-auto-scroll";
import { ArrowDown } from "lucide-react";

export type ConversationTimelineProps = {
  events: LoadState<SessionEventItem[]>;
  messages: LoadState<ChatMessage[]>;
  onSelectToolEvent: (eventId: string) => void;
  plan: AgentPlan | null;
  planning: boolean;
  executing: boolean;
  selectedToolEventId: string | null;
  task: AgentTaskItem | null;
};

export default function ConversationTimeline({
  events,
  messages,
  plan,
  planning,
  executing,
  selectedToolEventId,
  task,
  onSelectToolEvent,
}: ConversationTimelineProps) {
  const [detailStep, setDetailStep] = useState<PlanStepView | null>(null);

  const scrollKey = [
    messages.type === "ready" ? messages.data.length : messages.type,
    events.type === "ready" ? events.data.length : events.type,
    plan?.id ?? "no-plan",
    planning ? "planning" : "idle",
    executing ? "executing" : "idle",
    task?.status ?? "no-task",
  ].join(":");

  const { bottomRef, handleScroll, pinnedToBottom, scrollRef, scrollToBottom } = useAutoScroll({
    watchKey: scrollKey,
  });

  if (messages.type === "loading" || events.type === "loading") {
    return <TimelineLoadingState />;
  }

  if (messages.type === "error") {
    return <ErrorBlock message={messages.message} />;
  }

  if (events.type === "error") {
    return <ErrorBlock message={events.message} />;
  }

  const viewModel = buildAgentRunViewModel(messages.data, events.data, plan);

  if (viewModel.timelineItems.length === 0) {
    return <TimelineEmptyState />;
  }

  return (
    <>
      <div className="relative min-h-0 flex-1">
        <div
          className="h-full overflow-y-auto px-8 py-8 max-md:px-4"
          onScroll={handleScroll}
          ref={scrollRef}
        >
          <div className="mx-auto grid max-w-3xl gap-7">
            {viewModel.timelineItems.map((item) =>
              item.kind === "message" ? (
                <div className="stream-in" key={item.id}>
                  <MessageBubble message={item.message} />
                </div>
              ) : viewModel.latestPlan ? (
                <div className="stream-in" key={item.id}>
                  <AgentRunBlock
                    events={events.data}
                    finalEvent={viewModel.finalEvent}
                    onSelectToolEvent={onSelectToolEvent}
                    onOpenStep={setDetailStep}
                    plan={viewModel.latestPlan}
                    planning={planning}
                    selectedToolEventId={selectedToolEventId}
                  />
                </div>
              ) : null,
            )}
            <TaskStatusCard task={task} />
            {planning || executing ? (
              <RunningBlock
                text={planning ? "正在理解任务并生成计划..." : "正在执行计划并同步工具结果..."}
              />
            ) : null}
            <div ref={bottomRef} />
          </div>
        </div>
        {!pinnedToBottom ? (
          <button
            className="absolute bottom-5 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-blue-400/30 bg-[#111421]/95 px-4 py-2 text-sm font-semibold text-blue-100 shadow-2xl shadow-black/40 backdrop-blur-xl transition hover:border-blue-300/60"
            onClick={() => scrollToBottom("smooth")}
            type="button"
          >
            <ArrowDown size={15} aria-hidden="true" />
            回到底部
          </button>
        ) : null}
      </div>
      {detailStep ? (
        <StepDetailDialog
          onClose={() => setDetailStep(null)}
          onSelectToolEvent={onSelectToolEvent}
          step={detailStep}
        />
      ) : null}
    </>
  );
}
