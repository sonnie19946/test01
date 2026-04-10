'use client'
import { NodeProps, Node } from '@xyflow/react'
import { TitleOnlyNode } from './TitleOnlyNode'

type PromptData = Record<string, any>
type PromptNode = Node<PromptData, 'prompt'>

function Icon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  )
}

export default function PromptNode({ id, selected, data }: NodeProps<PromptNode>) {
  return (
    <TitleOnlyNode
      id={id} selected={selected}
      typeLabel="提示词" icon={<Icon />}
      titleFields={['subject', 'name', 'label']}
      summaryField="fullPrompt"
      data={data}
      showTargetHandle
      sourceHandleId="to_image"
    />
  )
}
