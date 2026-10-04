from fastapi import APIRouter

from app.presentation.http.routes import status, sessions, files, config, llm, agent_thinking, agent_core, sandboxes, \
    mcp, a2a, multi_agent, memories, harness, observability

# 创建总路由
api_router = APIRouter()

# 注册路由
api_router.include_router(status.router)
api_router.include_router(sessions.router)
api_router.include_router(files.router)
api_router.include_router(config.router)
api_router.include_router(llm.router)
api_router.include_router(agent_thinking.router)
api_router.include_router(agent_core.router)
api_router.include_router(sandboxes.router)
api_router.include_router(mcp.router)
api_router.include_router(a2a.router)
api_router.include_router(multi_agent.router)
api_router.include_router(memories.router)
api_router.include_router(harness.router)
api_router.include_router(observability.router)
