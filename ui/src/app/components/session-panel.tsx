import { formatDate } from "@/lib/format";
import type { SessionItem } from "@/types/sessions";
import StatusField from "./status-field";

export default function SessionPanel({
  selectedSession,
}: {
  selectedSession: SessionItem | null;
}) {
  return selectedSession ? (
    <div>
      <StatusField label="标题" value={selectedSession.title} />
      <StatusField label="状态" value={selectedSession.status} />
      <StatusField
        label="未读数"
        value={String(selectedSession.unread_count)}
      />
      <StatusField
        label="更新时间"
        value={formatDate(selectedSession.updated_at)}
      />
    </div>
  ) : (
    <div>创建或选择一个会话</div>
  );
}
