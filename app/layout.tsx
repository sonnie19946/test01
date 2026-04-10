import type { Metadata } from 'next'

import './globals.css'
import { cn } from "@/lib/utils";
import { Toaster } from 'sonner'

// ——— 字体：统一使用 OPPOSans
const fallbackFont = '"OPPOSans", "PingFang SC", "Microsoft YaHei", sans-serif'


export const metadata: Metadata = {
  title: '剧本分镜工作台',
  description: '剧本可视化工作台 — 从文字到影像',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // 强制 light 模式，禁用 hydration 警告（Next.js SSR 时间戳差异）
    <html lang="zh" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://chinese-fonts-cdn.deno.dev/packages/opposans/dist/OPPOSans-R/result.css" />
        <link rel="stylesheet" href="https://chinese-fonts-cdn.deno.dev/packages/opposans/dist/OPPOSans-M/result.css" />
        <link rel="stylesheet" href="https://chinese-fonts-cdn.deno.dev/packages/opposans/dist/OPPOSans-B/result.css" />
      </head>
      <body className="antialiased">
        <Toaster position="top-center" richColors theme="light" />
        {children}
      </body>
    </html>
  )
}
