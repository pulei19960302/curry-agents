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
      <div className="flex-1 overflow-y-auto px-8 py-8 max-md:px-4">
        <div className="mx-auto grid max-w-3xl gap-7">
          {viewModel.timelineItems.map((item) =>
            item.kind === "message" ? (
              <MessageBubble key={item.id} message={item.message} />
            ) : viewModel.latestPlan ? (
              <AgentRunBlock
                events={events.data}
                finalEvent={viewModel.finalEvent}
                key={item.id}
                onSelectToolEvent={onSelectToolEvent}
                onOpenStep={setDetailStep}
                plan={viewModel.latestPlan}
                planning={planning}
                selectedToolEventId={selectedToolEventId}
              />
            ) : null,
          )}
          <TaskStatusCard task={task} />
          {planning || executing ? (
            <RunningBlock
              text={planning ? "正在理解任务并生成计划..." : "正在执行计划并同步工具结果..."}
            />
          ) : null}
        </div>
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
