import React from 'react'
import { Field, useFormHelpers } from './FormUtils'
import { PromptNodeData } from '@/types/nodes'

export function PromptForm({ nodeId, data }: { nodeId: string, data: PromptNodeData }) {
  const { str, nested, set, setNested } = useFormHelpers(nodeId, data)
  return (
    <>
      <Field label="完整提示词" value={str('fullPrompt')} onChange={v => set('fullPrompt', v)} multiline />
      <Field label="负面提示词" value={str('negativePrompt')} onChange={v => set('negativePrompt', v)} multiline />
      <Field label="主体" value={str('subject')} onChange={v => set('subject', v)} multiline />
      <Field label="环境" value={str('environment')} onChange={v => set('environment', v)} multiline />
      <Field label="镜头" value={nested('technical', 'camera')} onChange={v => setNested('technical', 'camera', v)} multiline />
      <Field label="构图" value={nested('technical', 'composition')} onChange={v => setNested('technical', 'composition', v)} multiline />
    </>
  )
}
