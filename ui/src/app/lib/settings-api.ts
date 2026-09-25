import { requestApi } from "./api";
import type { AppSettingsData, SettingsIntegration, SettingsModule } from "@/types/setting";

export function fetchAppSettings(): Promise<AppSettingsData> {
  return requestApi<AppSettingsData>("/api/config/app");
}

export function updateSettingsModule(
  moduleKey: string,
  payload: { enabled?: boolean; default_item?: string },
): Promise<SettingsModule> {
  return requestApi<SettingsModule>(`/api/config/modules/${moduleKey}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function createSettingsIntegration(payload: {
  kind: string;
  name: string;
  description: string;
  endpoint: string;
}): Promise<SettingsIntegration> {
  return requestApi<SettingsIntegration>("/api/config/integrations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteSettingsIntegration(integrationId: string): Promise<SettingsIntegration> {
  return requestApi<SettingsIntegration>(`/api/config/integrations/${integrationId}`, {
    method: "DELETE",
  });
}
