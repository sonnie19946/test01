'use client'
import { NodeProps } from '@xyflow/react'
import { TitleOnlyNode } from './TitleOnlyNode'
import type { ShotNode } from '@/types/nodes'

const TARGET_HANDLES = [
  { id: 'assets_all', top: '10%' },
  { id: 'character',  top: '25%' },
  { id: 'appearance', top: '40%' },
  { id: 'scene',      top: '60%' },
  { id: 'prop',       top: '80%' },
]

function Icon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
      <line x1="7" y1="2" x2="7" y2="22"/>
      <line x1="17" y1="2" x2="17" y2="22"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <line x1="2" y1="7" x2="7" y2="7"/>
      <line x1="2" y1="17" x2="7" y2="17"/>
      <line x1="17" y1="17" x2="22" y2="17"/>
      <line x1="17" y1="7" x2="22" y2="7"/>
    </svg>
  )
}

export default function ShotNode({ id, selected, data }: NodeProps<ShotNode>) {
  return (
    <TitleOnlyNode
      id={id} selected={selected} loading={data.loading}
      typeLabel="分镜" icon={<Icon />}
      titleFields={['title', 'name', 'label']}
      subtitleField="number"
      summaryField="plot"
      data={data}
      targetHandles={TARGET_HANDLES}
      sourceHandleId="to_prompt"
      containerStyle={{ width: '290px' }}
    />
  )
}
