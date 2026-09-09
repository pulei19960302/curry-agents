export type VncStatusData = {
  enabled: boolean; // 是否启用 VNC/noVNC 远程桌面。
  display: string; // Xvfb 虚拟显示器编号，例如 :99。
  vnc_port: number; // 容器内 x11vnc 端口，主要用于排查。
  web_port: number; // 容器内 noVNC/websockify 端口，Nginx 会代理它。
  iframe_path: string; // 兼容字段，本章前端主要使用 websocket_path。
  websocket_path: string; // 前端 noVNC SDK 连接 websockify 使用的 WebSocket 路径。
  message: string; // 状态说明，显示在 VNC 面板中。
};
