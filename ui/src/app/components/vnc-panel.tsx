import { Monitor, RefreshCcw, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { VncStatusData } from "@/types/vnc";
import type { LoadState } from "@/types/sessions";

type VncPanelProps = {
  onRefresh: () => void; // 重新读取 /sandbox-api/vnc/status。
  state: LoadState<VncStatusData>; // 来自 Sandbox API，包含 websockify 连接路径。
};

type VncConnectionState = "idle" | "connecting" | "connected" | "error";

type RfbInstance = EventTarget & {
  scaleViewport: boolean;
  resizeSession: boolean;
  viewOnly: boolean;
  disconnect: () => void;
};

type RfbConstructor = new (target: HTMLElement, url: string) => RfbInstance;

// ===================== 第1步：展示 Sandbox 浏览器远程桌面 =====================
export default function VncPanel({ onRefresh, state }: VncPanelProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">浏览器远程桌面</h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            查看 Sandbox 中有头浏览器的实时画面
          </p>
        </div>
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          onClick={onRefresh}
          title="刷新 VNC 状态"
          type="button"
        >
          <RefreshCcw size={16} />
        </button>
      </div>

      {state.type === "loading" ? (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
          正在读取远程桌面状态...
        </div>
      ) : null}

      {state.type === "error" ? (
        <div className="mt-4 flex gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <XCircle className="mt-0.5 shrink-0" size={16} />
          <span>{state.message}</span>
        </div>
      ) : null}

      {state.type === "ready" ? <VncReadyView data={state.data} /> : null}
    </div>
  );
}

function VncReadyView({ data }: { data: VncStatusData }) {
  const screenRef = useRef<HTMLDivElement | null>(null);
  const rfbRef = useRef<RfbInstance | null>(null);
  const [connectionState, setConnectionState] = useState<VncConnectionState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!data.enabled || !screenRef.current) {
      return;
    }

    let disposed = false;

    // 1. VNC 不跟随 UI 的 3000 端口，而是固定走 Nginx 公共入口。
    //    入口为 HTTP 时转成 ws；入口为 HTTPS 时转成 wss。
    const websocketUrl = buildVncWebsocketUrl(data.websocket_path);

    setConnectionState("connecting");
    setErrorMessage(null);

    async function connectRemoteDesktop() {
      try {
        // 2. noVNC 会在模块初始化时访问 window，所以必须放在浏览器端动态导入。
        const module = (await import("@novnc/novnc")) as {
          default: RfbConstructor;
        };
        if (disposed || !screenRef.current) {
          return;
        }

        // 3. 创建 noVNC RFB 实例。target 是一个普通 div，SDK 会把远程桌面画面渲染进去。
        const rfb = new module.default(screenRef.current, websocketUrl); // 创建
        rfb.scaleViewport = true;
        rfb.resizeSession = false;
        rfb.viewOnly = false;
        rfbRef.current = rfb;

        // 4. 监听连接状态，给用户明确反馈，而不是只显示黑框。
        rfb.addEventListener("connect", () => {
          setConnectionState("connected");
        });
        rfb.addEventListener("disconnect", (event) => {
          const detail = (event as CustomEvent<{ clean?: boolean }>).detail;
          if (detail?.clean) {
            setConnectionState("idle");
            return;
          }
          setConnectionState("error");
          setErrorMessage("远程桌面连接断开，请检查 Sandbox 和 Nginx 日志。");
        });
        rfb.addEventListener("securityfailure", () => {
          setConnectionState("error");
          setErrorMessage("远程桌面安全握手失败。");
        });
      } catch (error) {
        if (disposed) {
          return;
        }
        const message = error instanceof Error ? error.message : "unknown error";
        setConnectionState("error");
        setErrorMessage(`远程桌面组件加载失败：${message}`);
      }
    }

    connectRemoteDesktop();

    return () => {
      disposed = true;
      if (!rfbRef.current) {
        return;
      }
      rfbRef.current.disconnect();
      rfbRef.current = null;
    };
  }, [data.enabled, data.websocket_path]);

  if (!data.enabled) {
    return (
      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
        VNC 未启用：{data.message}
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3">
      <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
        <Monitor size={16} />
        <span>{getConnectionText(connectionState, data.message)}</span>
      </div>
      {errorMessage ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          {errorMessage}
        </div>
      ) : null}
      <div className="h-[260px] overflow-hidden rounded-md border border-slate-200 bg-slate-950">
        <div className="h-full w-full" ref={screenRef} />
      </div>
      <dl className="grid gap-2 text-xs text-slate-600">
        <div className="flex justify-between gap-3">
          <dt>显示器</dt>
          <dd className="font-medium text-slate-900">{data.display}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Web 端口</dt>
          <dd className="font-medium text-slate-900">{data.web_port}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>WebSocket</dt>
          <dd className="truncate font-medium text-slate-900">{data.websocket_path}</dd>
        </div>
      </dl>
    </div>
  );
}

function getConnectionText(state: VncConnectionState, fallback: string) {
  if (state === "connecting") {
    return "正在连接远程桌面...";
  }
  if (state === "connected") {
    return "远程桌面已连接";
  }
  if (state === "error") {
    return "远程桌面连接异常";
  }
  return fallback;
}

function buildVncWebsocketUrl(websocketPath: string): string {
  // NEXT_PUBLIC_* 会在前端构建时注入浏览器代码。未设置时仍可兼容从 Nginx
  // 直接打开 UI 的场景，此时使用当前页面所在的 origin。
  const proxyOrigin = process.env.NEXT_PUBLIC_VNC_PROXY_ORIGIN ?? window.location.origin;
  const url = new URL(`/${websocketPath.replace(/^\/+/, "")}`, proxyOrigin);

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}
