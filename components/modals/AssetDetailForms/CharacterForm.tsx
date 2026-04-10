import React from 'react'
import { Field, SectionDivider, useFormHelpers } from './FormUtils'
import { CharacterNodeData } from '@/types/nodes'

export function CharacterForm({ nodeId, data }: { nodeId: string, data: CharacterNodeData }) {
  const { str, strArr, set, setArr } = useFormHelpers(nodeId, data)
  return (
    <>
      <Field label="✨ 时代背景设定" value={str('eraSetting')} readOnly />
      <Field label="姓名" value={str('name')} onChange={v => set('name', v)} />
      <Field label="性别" value={str('gender')} onChange={v => set('gender', v)} />
      <Field label="年龄段" value={str('ageRange')} onChange={v => set('ageRange', v)} />
      <Field label="简介" value={str('summary')} onChange={v => set('summary', v)} multiline />
      <Field label="性格标签（逗号分隔）" value={strArr('keyTraits')} onChange={v => setArr('keyTraits', v)} />
      <SectionDivider label="面部特征" />
      <Field label="脸型" value={str('faceShape')} onChange={v => set('faceShape', v)} multiline />
      <Field label="肤色" value={str('skinTone')} onChange={v => set('skinTone', v)} multiline />
      <Field label="眼睛" value={str('eyes')} onChange={v => set('eyes', v)} multiline />
      <Field label="眉毛" value={str('eyebrows')} onChange={v => set('eyebrows', v)} multiline />
      <Field label="鼻子" value={str('nose')} onChange={v => set('nose', v)} multiline />
      <Field label="嘴型" value={str('mouth')} onChange={v => set('mouth', v)} multiline />
      <Field label="下巴" value={str('chin')} onChange={v => set('chin', v)} multiline />
      <Field label="发型" value={str('hair')} onChange={v => set('hair', v)} multiline />
    </>
  )
}
