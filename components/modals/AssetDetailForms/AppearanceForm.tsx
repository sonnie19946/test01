import React from 'react'
import { Field, SectionDivider, useFormHelpers } from './FormUtils'
import { AppearanceNodeData } from '@/types/nodes'

export function AppearanceForm({ nodeId, data }: { nodeId: string, data: AppearanceNodeData }) {
  const { str, set } = useFormHelpers(nodeId, data)
  return (
    <>
      <Field label="✨ 时代背景设定" value={str('eraSetting')} readOnly />
      <Field label="角色名称" value={str('characterName')} onChange={v => set('characterName', v)} />
      <Field label="版本/身份标识" value={str('versionName')} onChange={v => set('versionName', v)} />
      <Field label="剧作状态与伤痕" value={str('temporalState')} onChange={v => set('temporalState', v)} multiline />
      <Field label="几何轮廓与体态" value={str('silhouette')} onChange={v => set('silhouette', v)} multiline />
      <SectionDivider label="服装与配饰" />
      <Field label="头部与面部配饰" value={str('headwear')} onChange={v => set('headwear', v)} multiline />
      <Field label="上半身" value={str('upperBody')} onChange={v => set('upperBody', v)} multiline />
      <Field label="下半身" value={str('lowerBody')} onChange={v => set('lowerBody', v)} multiline />
      <Field label="鞋靴" value={str('footwear')} onChange={v => set('footwear', v)} multiline />
      <Field label="随身小物件与手部" value={str('accessories')} onChange={v => set('accessories', v)} multiline />
      {str('clothingAndMaterials') && <Field label="[兼容旧版] 服装材质与磨损" value={str('clothingAndMaterials')} onChange={v => set('clothingAndMaterials', v)} multiline />}
      <Field label="着装附加身份线索" value={str('clothingIdentity')} onChange={v => set('clothingIdentity', v)} multiline />
      <Field label="非视觉感官映射" value={str('sensoryTranslation')} onChange={v => set('sensoryTranslation', v)} multiline />
      <Field label="纯客观色彩分布" value={str('colorScheme')} onChange={v => set('colorScheme', v)} multiline />
      <SectionDivider label="多视图与几何" />
      <Field label="正面构图与几何" value={str('frontView')} onChange={v => set('frontView', v)} multiline />
      <Field label="背面构图与纹理" value={str('backView')} onChange={v => set('backView', v)} multiline />
      <Field label="侧面细节" value={str('sideDetail')} onChange={v => set('sideDetail', v)} multiline />
      <Field label="补充说明" value={str('description')} onChange={v => set('description', v)} multiline />
    </>
  )
}
