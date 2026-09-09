import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // "standalone" 用于 Docker 部署。Next.js 构建后会生成一个独立运行的服务目录
  allowedDevOrigins: ["192.168.0.101"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          // 本地直接运行 pnpm dev 时同样通过宿主机 Nginx；Docker 内由 Compose
          // 注入 http://nginx/api/:path*，避免 UI 直连 api:8000。
          process.env.API_PROXY_URL ?? "http://localhost:8088/api/:path*",
      },
    ];
  },
};

export default nextConfig;
