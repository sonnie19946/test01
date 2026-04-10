import React from 'react'
import { Field, useFormHelpers } from './FormUtils'
import { ShotNodeData } from '@/types/nodes'

export function ShotForm({ nodeId, data }: { nodeId: string, data: ShotNodeData }) {
  const { str, set } = useFormHelpers(nodeId, data)
  return (
    <>
      <Field label="编号" value={str('number')} onChange={v => set('number', v)} />
      <Field label="标题" value={str('title')} onChange={v => set('title', v)} />
      <Field label="情节" value={str('plot')} onChange={v => set('plot', v)} multiline />
      <Field label="机位" value={str('camera')} onChange={v => set('camera', v)} multiline />
      <Field label="构图" value={str('composition')} onChange={v => set('composition', v)} multiline />
      <Field label="动作" value={str('action')} onChange={v => set('action', v)} multiline />
      <Field label="情绪" value={str('emotion')} onChange={v => set('emotion', v)} multiline />
      <Field label="视觉焦点" value={str('visualFocus')} onChange={v => set('visualFocus', v)} multiline />
      <Field label="特殊要求" value={str('specialRequirements')} onChange={v => set('specialRequirements', v)} multiline />
    </>
  )
}
