FROM python:3.12-slim

# 避免容器里生成大量 .pyc 文件。
ENV PYTHONDONTWRITEBYTECODE=1

# 让日志及时输出到 Docker logs
ENV PYTHONUNBUFFERED=1

# 让 uv 安装时编译字节码，提升启动表现
ENV UV_COMPILE_BYTECODE=1

# 让依赖安装更适合容器层
ENV UV_LINK_MODE=copy


WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:0.11.15 /uv /uvx /bin/

COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app ./app

RUN uv sync --frozen --no-dev

# 端口8100
EXPOSE 8100

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]