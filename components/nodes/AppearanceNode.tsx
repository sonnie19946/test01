'use client'
import { NodeProps } from '@xyflow/react'
import { TitleOnlyNode } from './TitleOnlyNode'
import { getAssetDisplayName } from '@/lib/getAssetDisplayName'
import type { AppearanceNode, AppearanceNodeData } from '@/types/nodes'

function Icon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      <path d="M17 13l3 3-3 3"/>
      <path d="M7 13l-3 3 3 3"/>
    </svg>
  )
}

export default function AppearanceNode({ id, selected, data }: NodeProps<AppearanceNode>) {
  // 用共享函数计算显示名，确保与引用面板一致
  const displayName = getAssetDisplayName('appearance', data)
  const patchedData: AppearanceNodeData = { ...data, _displayName: displayName }

  return (
    <TitleOnlyNode
      id={id} selected={selected}
      typeLabel="角色形象" icon={<Icon />}
      titleFields={['_displayName']}
      summaryField="temporalState"
      data={patchedData}
      showTargetHandle
      sourceHandleId="to_shot"
    />
  )
}
