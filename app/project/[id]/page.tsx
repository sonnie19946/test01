'use client'

import dynamic from 'next/dynamic'
import { use } from 'react'

// SSR 必须禁用：React Flow 依赖浏览器 DOM API
const FlowCanvas = dynamic(
  () => import('@/components/canvas/FlowCanvas'),
  { ssr: false }
)

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <FlowCanvas boardId={id} />
}

