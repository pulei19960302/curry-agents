import { Database } from "lucide-react";

import StatusField from "./status-field";
import type { ApiStatusData, DatabaseStatusData } from "@/types/api";
import type { LoadState } from "@/types/sessions";

type StatusPanelProps = {
  apiStatus: LoadState<ApiStatusData>;
  databaseStatus: LoadState<DatabaseStatusData>;
};

export default function StatusPanel({
  apiStatus,
  databaseStatus,
}: StatusPanelProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-sky-50 text-sky-700">
          <Database size={20} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-950">服务状态</h2>
          <p className="mt-1 text-sm text-slate-500">API 与数据库连接状态</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <StatusField
          label="服务名称"
          value={apiStatus.type === "ready" ? apiStatus.data.service : "-"}
        />
        <StatusField
          label="运行环境"
          value={apiStatus.type === "ready" ? apiStatus.data.environment : "-"}
        />
        <StatusField
          label="API 状态"
          value={
            apiStatus.type === "ready" ? apiStatus.data.status : apiStatus.type
          }
        />
        <StatusField
          label="数据库状态"
          value={
            databaseStatus.type === "ready"
              ? databaseStatus.data.status
              : databaseStatus.type
          }
        />
      </div>
    </div>
  );
}
