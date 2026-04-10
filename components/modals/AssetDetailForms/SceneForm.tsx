import React from 'react'
import { Field, useFormHelpers } from './FormUtils'
import { SceneNodeData } from '@/types/nodes'

export function SceneForm({ nodeId, data }: { nodeId: string, data: SceneNodeData }) {
  const { str, set } = useFormHelpers(nodeId, data)
  return (
    <>
      <Field label="✨ 时代背景设定" value={str('eraSetting')} readOnly />
      <Field label="场景名称" value={str('name')} onChange={v => set('name', v)} />
      <Field label="建筑风格与空间拓扑" value={str('architectureAndTopology')} onChange={v => set('architectureAndTopology', v)} multiline />
      <Field label="光影系统与大气介质" value={str('lightingAndAtmosphere')} onChange={v => set('lightingAndAtmosphere', v)} multiline />
      <Field label="地表材质与自然侵蚀" value={str('materialsAndWeathering')} onChange={v => set('materialsAndWeathering', v)} multiline />
      <Field label="静态视觉锚点" value={str('staticVisualAnchors')} onChange={v => set('staticVisualAnchors', v)} multiline />
      <Field label="色彩方案与分布" value={str('colorPalette')} onChange={v => set('colorPalette', v)} multiline />
    </>
  )
}
