'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getAllTemplates,
  setAllTemplates,
  resetToDefaults,
  getDefaults,
  sanitizePromptText,
  TEMPLATE_TYPE_LABELS,
  type PromptNodeType,
  type PromptTemplate,
} from '@/lib/promptTemplates'

// ── 节点类型顺序 ─────────────────────────────────────────────
const TAB_ORDER: PromptNodeType[] = ['character', 'appearance', 'scene', 'prop']

// ── Field 组件（textarea 自动适应文本高度）──────────────────────
function TemplateField({ label, value, onChange, hint, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151', letterSpacing: '0.02em' }}>{label}</span>
        {hint && <span style={{ fontSize: '10px', color: '#9CA3AF' }}>{hint}</span>}
      </div>
      <textarea
        ref={ref}
        placeholder={placeholder}
        value={value}
        onChange={e => {
          onChange(e.target.value)
          const el = e.currentTarget
          el.style.height = 'auto'
          el.style.height = el.scrollHeight + 'px'
        }}
        rows={1}
        style={{
          width: '100%', padding: '10px 14px', border: '1px solid #E5E7EB', borderRadius: '8px',
          fontSize: '13px', color: '#1F2937', fontFamily: 'var(--font-ui, system-ui, sans-serif)',
          lineHeight: 1.65, outline: 'none', resize: 'none', overflow: 'hidden',
          background: '#FFFFFF', boxSizing: 'border-box', transition: 'border-color 150ms',
        }}
        onFocus={e => { (e.target as HTMLElement).style.borderColor = '#6B83CC' }}
        onBlur={e => { (e.target as HTMLElement).style.borderColor = '#E5E7EB' }}
      />
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────
export default function PromptConfigModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<PromptNodeType>('character')
  const [templates, setTemplates] = useState<Record<PromptNodeType, PromptTemplate>>(getDefaults)
  const [dirty, setDirty] = useState(false)

  // 打开时加载最新数据
  useEffect(() => {
    if (open) {
      setTemplates(getAllTemplates())
      setDirty(false)
    }
  }, [open])

  // ESC 关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  const updateField = useCallback((type: PromptNodeType, field: keyof PromptTemplate, value: string) => {
    setTemplates(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }))
    setDirty(true)
  }, [])

  const handleSave = useCallback(() => {
    setAllTemplates(templates)
    setDirty(false)
    onClose()
  }, [templates, onClose])

  const handleReset = useCallback(() => {
    const defaults = getDefaults()
    setTemplates(defaults)
    setDirty(true)
  }, [])

  // 预览文本
  const previewText = (() => {
    const t = templates[activeTab]
    const parts = [t.prefix, t.constraints, '[ ... 节点数据将在此动态填充 ... ]', t.suffix].filter(Boolean)
    return sanitizePromptText(parts.join('\n'))
  })()

  if (!open) return null

  const current = templates[activeTab]

  return (
    <div
      onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 2500,
        background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{
        background: '#FFFFFF', borderRadius: '16px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
        width: '100%', maxWidth: '900px', height: '82vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: 'var(--font-ui, system-ui, sans-serif)',
      }}>

        {/* ── 标题栏 ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 28px 16px', borderBottom: '1px solid #F3F4F6', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '2px' }}>
              PROMPT TEMPLATES
            </div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' }}>
              前置提示词配置
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleReset}
              style={{
                padding: '7px 14px', borderRadius: '8px',
                border: '1px solid #E5E7EB', background: '#FFFFFF',
                color: '#6B7280', fontSize: '12.5px', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F9FAFB' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#FFFFFF' }}
            >
              恢复默认
            </button>
            <button
              onClick={onClose}
              title="关闭 (ESC)"
              style={{
                width: '28px', height: '28px', borderRadius: '6px', border: 'none',
                background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#9CA3AF', transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = '#F3F4F6'; el.style.color = '#374151' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = '#9CA3AF' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18" /><path d="M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── 内容区：左 tab + 右编辑 ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* 左侧 Tab 列表 */}
          <div style={{
            width: '180px', flexShrink: 0,
            borderRight: '1px solid #F3F4F6',
            padding: '12px 0', overflowY: 'auto',
          }}>
            {TAB_ORDER.map(type => {
              const isActive = activeTab === type
              return (
                <div
                  key={type}
                  onClick={() => setActiveTab(type)}
                  style={{
                    padding: '10px 20px', cursor: 'pointer',
                    fontSize: '13.5px', fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#111827' : '#6B7280',
                    background: isActive ? '#F5F5F3' : 'transparent',
                    borderLeft: isActive ? '3px solid #4F6DC8' : '3px solid transparent',
                    transition: 'all 120ms', userSelect: 'none',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = '#FAFAF8'
                  }}
                  onMouseLeave={e => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
                  }}
                >
                  {TEMPLATE_TYPE_LABELS[type]}
                </div>
              )
            })}
          </div>

          {/* 右侧编辑区 */}
          <div style={{ flex: 1, padding: '20px 28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <TemplateField
              label="前置指令 (Prefix)"
              hint="提示词最前面的核心指令"
              value={current.prefix}
              onChange={v => updateField(activeTab, 'prefix', v)}
            />
            <TemplateField
              label="约束条件 (Constraints)"
              hint="场景 / 视角 / 特殊限制（可留空）"
              value={current.constraints || ''}
              onChange={v => updateField(activeTab, 'constraints', v)}
            />
            <TemplateField
              label="后缀 (Suffix)"
              hint="画幅 / 摄影机 / 品质限定"
              value={current.suffix}
              onChange={v => updateField(activeTab, 'suffix', v)}
            />

            {/* ── 预览 ── */}
            <div style={{
              background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px',
              padding: '14px 16px', marginTop: '4px',
            }}>
              <div style={{
                fontSize: '11px', fontWeight: 600, color: '#9CA3AF',
                letterSpacing: '0.06em', marginBottom: '8px',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                拼接预览
              </div>
              <div style={{
                fontSize: '12.5px', color: '#4B5563', lineHeight: 1.7,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {previewText}
              </div>
            </div>
          </div>
        </div>

        {/* ── 底部操作 ── */}
        <div style={{
          padding: '14px 28px 18px', borderTop: '1px solid #F3F4F6',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px',
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 20px', borderRadius: '8px',
              border: '1px solid #E5E7EB', background: '#FFFFFF',
              color: '#374151', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'background 150ms',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F9FAFB' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#FFFFFF' }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty}
            style={{
              padding: '9px 20px', borderRadius: '8px',
              border: 'none', background: dirty ? '#4F6DC8' : '#E5E7EB',
              color: dirty ? '#FFFFFF' : '#9CA3AF',
              fontSize: '13px', fontWeight: 600,
              cursor: dirty ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', transition: 'all 150ms',
            }}
            onMouseEnter={e => { if (dirty) (e.currentTarget as HTMLElement).style.background = '#3D5AB5' }}
            onMouseLeave={e => { if (dirty) (e.currentTarget as HTMLElement).style.background = '#4F6DC8' }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
