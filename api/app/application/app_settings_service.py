from uuid import uuid4

from app.application.a2a_service import A2aService
from app.application.llm_service import LLMService
from app.application.mcp_service import McpService
from app.application.multi_agent_service import MultiAgentService
from app.domain.app_setting.entities import SettingsIntegration, AppSettingsSnapshot, SettingsModule


class AppSettingsService:
    """聚合 LLM、MCP、A2A 和多 Agent 的设置页数据。

       当前版本不直接改写 YAML 配置文件，也不从接口接收真实密钥。
       浏览器中的操作会写入进程内状态，用来先打通设置页交互和接口协议。
       """

    def __init__(
            self,
            llm_service: LLMService | None = None,
            mcp_service: McpService | None = None,
            a2a_service: A2aService | None = None,
            multi_agent_service: MultiAgentService | None = None,
    ) -> None:
        # 这些服务负责读取各自已有配置；设置服务只做聚合和运行时开关。
        self.llm_service = llm_service or LLMService()
        self.mcp_service = mcp_service or McpService()
        self.a2a_service = a2a_service or A2aService()
        self.multi_agent_service = multi_agent_service or MultiAgentService()

        # module_overrides 只影响设置页展示，避免把临时操作写坏 YAML。
        self.module_overrides: dict[str, dict[str, object]] = {}
        self.integrations: dict[str, SettingsIntegration] = {}

    def get_snapshot(self) -> AppSettingsSnapshot:
        """返回设置页需要展示的完整快照。"""

        modules = [
            self._build_llm_module(),
            self._build_mcp_module(),
            self._build_a2a_module(),
            self._build_multi_agent_module()
        ]

        return AppSettingsSnapshot(
            modules=[self._apply_override(module) for module in modules],
            integrations=list(self.integrations.values()),
        )

    # 更新模块
    def update_module(
            self,
            module_key: str,
            enabled: bool | None = None,
            default_item: str | None = None
    ) -> SettingsModule:
        """更新某个模块的启用状态或默认项。"""

        # 1. 先确认模块存在，避免调用方传入拼错的 key。
        current_module = self._find_module(module_key)

        # 2. 读取已有覆盖值，然后按请求字段更新。
        override = dict(self.module_overrides.get(module_key, {}))

        if enabled is not None:
            override["enabled"] = enabled
        if default_item is not None:
            override["default_item"] = default_item

        # 3. 保存覆盖值，并返回应用覆盖后的最新模块。
        self.module_overrides[module_key] = override
        return self._apply_override(current_module)

    # 新增模块
    def add_integration(
            self,
            kind: str,
            name: str,
            description: str = "",
            endpoint: str | None = None,
    ) -> SettingsIntegration:
        """新增一条设置页集成记录。"""

        # 1. 生成前端可稳定使用的 ID。
        integration = SettingsIntegration(
            id=str(uuid4()),
            kind=kind,
            name=name.strip(),
            description=description.strip(),
            endpoint=endpoint.strip() if endpoint else None,
            enabled=True,
        )

        # 2. 保存到进程内状态。重启 API 后会恢复为 YAML 配置。
        self.integrations[integration.id] = integration
        return integration

    # 删除
    def delete_integration(self, integration_id: str) -> SettingsIntegration:
        """删除一条设置页集成记录。"""

        integration = self.integrations.pop(integration_id, None)
        if integration is None:
            raise KeyError(integration_id)
        return integration

    # 查询module
    def _find_module(self, module_key: str) -> SettingsModule:

        for module in self.get_snapshot().modules:
            if module.key == module_key:
                return module

        raise KeyError(module_key)

    def _apply_override(self, module: SettingsModule) -> SettingsModule:

        override = self.module_overrides.get(module.key, {})

        return SettingsModule(
            key=module.key,
            name=module.name,
            description=module.description,
            enabled=bool(override.get("enabled", module.enabled)),
            default_item=str(override.get("default_item", module.default_item))
            if override.get("default_item", module.default_item) is not None
            else None,
            items=module.items,
        )

    def _build_llm_module(self) -> SettingsModule:
        public_config = self.llm_service.get_public_config()

        return SettingsModule(
            key="llm",
            name="LLM",
            description="模型服务商、默认模型和调用参数。",
            enabled=True,
            default_item=str(public_config["default_provider"]),
            items=[
                {
                    "name": provider["name"],
                    "description": provider["base_url"],
                    "enabled": provider["configured"],
                    "metadata": {
                        "api_key_env": provider["api_key_env"],
                        "configured": provider["configured"],
                    },
                }
                for provider in public_config["providers"]
            ]
        )

    def _build_mcp_module(self) -> SettingsModule:
        mcp_servers = self.mcp_service.list_servers()

        default_mcp = self.mcp_service.get_default_server()

        return SettingsModule(
            key="mcp",
            name="MCP",
            description="外部工具服务器和工具发现配置。",
            enabled=True,
            default_item=default_mcp,
            items=[
                {
                    "name": server.name,
                    "description": server.description,
                    "enabled": server.enabled,
                    "metadata": {"transport": server.transport},
                }
                for server in mcp_servers

            ]
        )

    def _build_a2a_module(self) -> SettingsModule:
        # agents
        agents = self.a2a_service.list_agents()

        return SettingsModule(
            key="a2a",
            name="A2A",
            description="远程 Agent 发现、Agent Card 和 message/send 调用配置。",
            enabled=True,
            default_item=self.a2a_service.get_default_agent(),
            items=[
                {
                    "name": agent.key,
                    "description": agent.description,
                    "enabled": agent.enabled,
                    "metadata": {
                        "transport": agent.transport,
                        "url": agent.url,
                        "version": agent.version,
                    },
                }
                for agent in agents
            ],
        )

    def _build_multi_agent_module(self) -> SettingsModule:
        roles = self.multi_agent_service.list_roles()

        return SettingsModule(
            key="multi_agent",
            name="多 Agent",
            description="Manager、Worker、Reviewer 的协作角色和编排开关。",
            enabled=True,
            default_item="manager",
            items=[
                {
                    "name": role.name,
                    "description": role.responsibility,
                    "enabled": True,
                    "metadata": {
                        "key": role.key,
                        "capability": role.capability,
                    },
                }
                for role in roles
            ],
        )


# ===================== 创建进程内共享设置服务 =====================
# 设置页的运行时开关和新增记录需要跨请求保存，所以这里使用模块级实例。
_app_settings_service = AppSettingsService()


def get_app_settings_service() -> AppSettingsService:
    return _app_settings_service
