#!/usr/bin/env bash

set -euo pipefail # 有错误就尽快退出


# 按需执行数据库迁移

# 容器启动时先执行迁移，避免用户忘记手动运行 alembic upgrade head。
# 本地排查时可以通过 RUN_MIGRATIONS=false 临时跳过。

if [[ "${RUN_MIGRATIONS:-true}" == "true" ]]; then
  uv run alembic upgrade head
fi

# 启动 FastAPI 服务
# 使用 exec 让 uvicorn 成为容器主进程，Docker 停止容器时信号能正确传递。
exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000