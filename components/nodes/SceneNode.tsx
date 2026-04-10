'use client'
import { NodeProps } from '@xyflow/react'
import { TitleOnlyNode } from './TitleOnlyNode'
import type { SceneNode } from '@/types/nodes'

function Icon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  )
}

export default function SceneNode({ id, selected, data }: NodeProps<SceneNode>) {
  return (
    <TitleOnlyNode
      id={id} selected={selected}
      typeLabel="场景" icon={<Icon />}
      titleFields={['name', 'label']}
      data={data}
      showTargetHandle
      sourceHandleId="to_shot"
    />
  )
}
