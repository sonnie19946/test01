'use client'
import { NodeProps } from '@xyflow/react'
import { TitleOnlyNode } from './TitleOnlyNode'
import type { CharacterNode } from '@/types/nodes'

const SOURCE_HANDLES = [{ id: 'character_out_unified', label: '', top: '50%' }]

function Icon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

export default function CharacterNode({ id, selected, data }: NodeProps<CharacterNode>) {
  return (
    <TitleOnlyNode
      id={id} selected={selected} loading={data.loading}
      typeLabel="角色" icon={<Icon />}
      titleFields={['name', 'label']}
      data={data}
      showTargetHandle
      sourceHandleId="character_out_unified"
    />
  )
}
