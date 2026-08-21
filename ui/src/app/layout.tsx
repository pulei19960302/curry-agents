import { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CurryAgent",
  description: "CurryAgent workspace",
};

function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

export default RootLayout;
