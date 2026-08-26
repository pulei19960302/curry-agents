FROM python:3.12-slim


ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:0.11.15 /uv /uvx /bin/
COPY pyproject.toml uv.lock README.md ./

RUN uv sync --frozen --no-dev --no-install-project

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./alembic.ini
COPY config ./config

RUN uv sync --frozen --no-dev

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# - 使用 python:3.12-slim 作为基础镜像。
#- 设置 /app 为工作目录。
#- 从官方 uv 镜像中取出 uv 命令。
#- 先根据 pyproject.toml 和 uv.lock 安装依赖。
#- 再把应用代码放入镜像。
#- 暴露容器内的 8000 端口。
#- 使用 uv run uvicorn 启动 FastAPI。
# 容器里必须监听 0.0.0.0，不能只监听 127.0.0.1。否则容器外部访问不到服务。
