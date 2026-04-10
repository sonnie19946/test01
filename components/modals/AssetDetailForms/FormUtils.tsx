import React, { useRef, useEffect } from 'react'
import { useFlowStore } from '@/hooks/useFlowStore'

// ── 样式常量 ──────────────────────────────────────────────────
export const INPUT_BASE: React.CSSProperties = {
  width: '100%',
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  color: '#111827',
  fontFamily: 'inherit',
  fontSize: '13px',
  lineHeight: 1.6,
  padding: '8px 12px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
  display: 'block',
}

export const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: '#374151',
  marginBottom: '5px',
}

// ── 自适应高度 Textarea ───────────────────────────────────────
export function AutoTextarea({
  value,
  onChange,
  readOnly,
  minRows = 1,
}: {
  value: string
  onChange?: (v: string) => void
  readOnly?: boolean
  minRows?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      readOnly={readOnly}
      rows={minRows}
      onChange={e => {
        onChange?.(e.target.value)
        const el = e.currentTarget
        el.style.height = 'auto'
        el.style.height = el.scrollHeight + 'px'
      }}
      style={{
        ...INPUT_BASE,
        background: readOnly ? '#FAFAFA' : '#FFFFFF',
        color: readOnly ? '#6B7280' : '#111827',
        resize: 'none',
        overflow: 'hidden',
      }}
      onFocus={e => { if (!readOnly) e.currentTarget.style.borderColor = '#6B7FD7' }}
      onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
    />
  )
}

// ── Field 组件 ────────────────────────────────────────────────
export function Field({
  label,
  value,
  onChange,
  readOnly,
  multiline,
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  readOnly?: boolean
  multiline?: boolean
}) {
  return (
    <div style={{ width: '100%' }}>
      <label style={LABEL_STYLE}>{label}</label>
      {multiline ? (
        <AutoTextarea value={value} onChange={onChange} readOnly={readOnly} minRows={1} />
      ) : (
        <input
          type="text"
          value={value}
          readOnly={readOnly}
          onChange={e => onChange?.(e.target.value)}
          style={{
            ...INPUT_BASE,
            background: readOnly ? '#FAFAFA' : '#FFFFFF',
            color: readOnly ? '#6B7280' : '#111827',
          }}
          onFocus={e => { if (!readOnly) e.currentTarget.style.borderColor = '#6B7FD7' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
        />
      )}
    </div>
  )
}

// ── 分区标题 ──────────────────────────────────────────────────
export function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: '11px', fontWeight: 600, color: '#9CA3AF',
      letterSpacing: '0.08em', textTransform: 'uppercase',
      borderBottom: '1px solid #F3F4F6',
      paddingBottom: '4px', marginTop: '6px',
    }}>
      {label}
    </div>
  )
}

// ── 表单辅助 Hooks ──────────────────────────────────────────
export function useFormHelpers(nodeId: string, nodeData: Record<string, any>) {
  const updateNodeData = useFlowStore(state => state.updateNodeData)

  const str = (k: string) => (nodeData[k] as string) ?? ''
  const strArr = (k: string) => ((nodeData[k] as string[]) ?? []).join(', ')
  const nested = (k: string, sub: string) => ((nodeData[k] as Record<string, string>)?.[sub]) ?? ''
  
  const set = (k: string, v: unknown) => updateNodeData(nodeId, { [k]: v })
  const setArr = (k: string, v: string) => updateNodeData(nodeId, { [k]: v.split(',').map(s => s.trim()).filter(Boolean) })
  const setNested = (k: string, sub: string, v: string) =>
    updateNodeData(nodeId, { [k]: { ...(nodeData[k] as object ?? {}), [sub]: v } })

  return { str, strArr, nested, set, setArr, setNested }
}
