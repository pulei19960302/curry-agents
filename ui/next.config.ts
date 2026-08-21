import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // "standalone" 用于 Docker 部署。Next.js 构建后会生成一个独立运行的服务目录
  allowedDevOrigins: ["192.168.0.101"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          process.env.API_PROXY_URL ?? "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
