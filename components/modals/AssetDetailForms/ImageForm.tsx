import React from 'react'
import { Field, useFormHelpers } from './FormUtils'

export function ImageForm({ nodeId, data }: { nodeId: string, data: Record<string, any> }) {
  const { str } = useFormHelpers(nodeId, data)
  return (
    <>
      <Field label="图像 URL" value={str('imageUrl')} readOnly />
      <Field label="模型" value={str('model')} readOnly />
      <Field label="尺寸" value={str('size')} readOnly />
      <Field label="状态" value={str('status')} readOnly />
    </>
  )
}
