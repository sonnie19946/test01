import React from 'react'
import { Field, SectionDivider, useFormHelpers } from './FormUtils'
import { PropNodeData } from '@/types/nodes'

export function PropForm({ nodeId, data }: { nodeId: string, data: PropNodeData }) {
  const { str, strArr, nested, set, setArr, setNested } = useFormHelpers(nodeId, data)
  return (
    <>
      <Field label="✨ 时代背景设定" value={str('eraSetting')} readOnly />
      <Field label="道具名称" value={str('name')} onChange={v => set('name', v)} />
      <Field label="忠实度备注" value={str('faithfulnessNote')} onChange={v => set('faithfulnessNote', v)} multiline />
      <Field label="出现场景（逗号分隔）" value={strArr('appearsInScenes')} onChange={v => setArr('appearsInScenes', v)} />
      <SectionDivider label="外观描述" />
      <Field label="几何结构" value={nested('appearance', 'baseStructure')} onChange={v => setNested('appearance', 'baseStructure', v)} multiline />
      <Field label="实物材质与物理老化" value={nested('appearance', 'materialAndWear')} onChange={v => setNested('appearance', 'materialAndWear', v)} multiline />
      <Field label="剧作使用痕迹" value={nested('appearance', 'interactiveTraces')} onChange={v => setNested('appearance', 'interactiveTraces', v)} multiline />
      <Field label="制造工艺与时代感" value={nested('appearance', 'manufacturing')} onChange={v => setNested('appearance', 'manufacturing', v)} multiline />
      <Field label="体量与视觉重量" value={nested('appearance', 'scaleAndWeight')} onChange={v => setNested('appearance', 'scaleAndWeight', v)} multiline />
    </>
  )
}
