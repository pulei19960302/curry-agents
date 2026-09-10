#!/usr/bin/env bash

set -eu


# ===================== 第1步：准备 VNC 相关默认配置 =====================
# DISPLAY 指向 Xvfb 创建的虚拟显示器。Playwright 使用 headless=false 时会把 Chromium 画面画到这里。
export DISPLAY="${DISPLAY:-${VNC-DISPLAY:-:99}}"

VNC_PORT="${VNC_PORT:-5900}"
VNC_WEB_PORT="${VNC_WEB_PORT:-6080}"


# 启动虚拟桌面和 noVNC 链路
if [[ "${VNC_ENABLED:-true}" == "true" ]]; then
  # Docker 重启不会清空容器可写层中的 /tmp。若上一次退出时留下 Xvfb 的
  # socket/lock，新进程会误判 :99 正在使用并直接退出。该脚本是容器入口，
  # 此时旧进程已经终止，因此可以安全清理当前 display 的遗留文件。
  DISPLAY_NUMBER="${DISPLAY#:}"
  DISPLAY_NUMBER="${DISPLAY_NUMBER%%.*}"
  if [[ "${DISPLAY_NUMBER}" =~ ^[0-9]+$ ]]; then
    rm -f "/tmp/.X${DISPLAY_NUMBER}-lock" "/tmp/.X11-unix/X${DISPLAY_NUMBER}"
  fi

  # Xvfb 提供一个没有真实显示器的 X11 桌面，浏览器窗口会运行在这个桌面里。
  Xvfb "${DISPLAY}" -screen 0 "${BROWSER_VIEWPORT_WIDTH:-1280}x${BROWSER_VIEWPORT_HEIGHT:-720}x24" &
  sleep 1

  # fluxbox 提供最轻量的窗口管理能力，让有头 Chromium 能正常创建窗口。
  fluxbox > /tmp/fluxbox.log 2>&1 &

  # x11vnc 把 Xvfb 桌面暴露成 VNC 端口。Xvfb 在容器重启时可能尚未完全
  # 可连接；若只启动一次，x11vnc 会直接退出，随后 websockify 无法连接 5900。
  # 因此这里持续重试，也能在 x11vnc 意外退出后恢复 VNC 服务。
  (
    while true; do
      x11vnc -display "${DISPLAY}" -rfbport "${VNC_PORT}" -forever -shared -nopw >>/tmp/x11vnc.log 2>&1
      sleep 1
    done
  ) &

  # websockify 把 VNC TCP 连接转换成浏览器可用的 WebSocket。
  # 这里使用 apt 安装到系统里的 websockify 命令，不走 Python 依赖，避免额外拉取 numpy。
  websockify "${VNC_WEB_PORT}" "127.0.0.1:${VNC_PORT}" >/tmp/websockify.log 2>&1 &
fi


# ===================== 第3步：启动 Sandbox FastAPI 服务 =====================
exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8100
