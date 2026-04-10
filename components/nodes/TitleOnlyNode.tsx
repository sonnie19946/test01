'use client'

import { useState, useCallback } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useFlowStore } from '@/hooks/useFlowStore'

// ── Handle 样式 ───────────────────────────────────────────────
const HANDLE_STYLE = { background: 'transparent', border: 'none' }
const handleCls = 'custom-handle'

// ── Props ─────────────────────────────────────────────────────
interface TitleNodeProps {
  id: string
  selected?: boolean
  loading?: boolean
  typeLabel: string
  icon?: React.ReactNode          // 保留接口兼容，当前设计不再展示 icon
  titleFields: string[]           // 按优先级读取主标题
  subtitleField?: string          // 副标题字段名（年龄 / 地点 / 编号等）
  summaryField?: string           // 描述摘要字段名
  tagsField?: string              // 标签数组字段名（string[]）
  data: Record<string, any>
  showTargetHandle?: boolean
  sourceHandleId?: string
  targetHandles?: { id: string; top: string }[]
  inlineSubtitle?: boolean
  containerStyle?: React.CSSProperties
}

// ── 主组件 ────────────────────────────────────────────────────
export function TitleOnlyNode({
  id, selected, loading,
  typeLabel, titleFields,
  subtitleField, summaryField, tagsField,
  data,
  showTargetHandle = true,
  sourceHandleId = 'to_shot',
  targetHandles,
  inlineSubtitle = false,
  containerStyle,
}: TitleNodeProps) {
  const { updateNodeData, deleteNode, openAssetModal } = useFlowStore()
  const [editing, setEditing] = useState(false)

  // ── 数据读取 ──
  const getRawTitle = () => {
    for (const f of titleFields) {
      if (data[f]) return data[f] as string
    }
    return ''
  }
  const title    = getRawTitle()
  const subtitle = subtitleField ? ((data[subtitleField] as string) ?? '') : ''
  const tags: string[] = tagsField ? ((data[tagsField] as string[]) ?? []) : []

  const saveTitle = useCallback((val: string) => {
    const patch: Record<string, string> = {}
    titleFields.forEach(f => { patch[f] = val })
    updateNodeData(id, patch)
    setEditing(false)
  }, [id, titleFields, updateNodeData])

  // ── 样式变量 ──
  const isActive = selected || loading
  const borderColor = isActive ? 'rgba(132,161,223,0.70)' : '#E8E8E4'
  const shadowBase  = '0 2px 12px -2px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)'
  const shadowSel   = '0 8px 28px -6px rgba(0,0,0,0.14), 0 0 0 2px rgba(132,161,223,0.22)'

  return (
    <div
      style={{
        background: '#FAFAF8',
        border: `1.5px solid ${borderColor}`,
        borderRadius: '18px',
        width: '270px',
        boxShadow: isActive ? shadowSel : shadowBase,
        position: 'relative',
        fontFamily: 'var(--font-ui, system-ui, sans-serif)',
        transition: 'border-color 160ms, box-shadow 160ms',
        /* overflow: hidden 会裁裁 Handle，不要加 */
        ...containerStyle,
      }}
    >
      {/* ── React Flow Handles ── */}
      {!targetHandles && showTargetHandle && (
        <Handle type="target" position={Position.Left} style={HANDLE_STYLE} className={handleCls} />
      )}
      {targetHandles?.map(h => (
        <Handle key={h.id} id={h.id} type="target" position={Position.Left}
          style={{ ...HANDLE_STYLE, top: h.top, transform: 'translateY(-50%)' }}
          className={handleCls}
        />
      ))}
      <Handle id={sourceHandleId} type="source" position={Position.Right}
        style={{ ...HANDLE_STYLE, top: '50%', transform: 'translateY(-50%)' }}
        className={handleCls}
      />

      {/* ── 顶部：类型标签 + 删除键 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '15px 15px 0',
      }}>
        <span style={{
          fontSize: '12px', fontWeight: 600, color: '#ABABAB',
          letterSpacing: '0.04em',
          userSelect: 'none',
        }}>
          {typeLabel}
        </span>

        <button
          className="nodrag"
          onClick={e => { e.stopPropagation(); deleteNode(id) }}
          title="删除节点"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '3px', display: 'flex', alignItems: 'center',
            color: '#D4D4D4', borderRadius: '5px',
            transition: 'color 150ms, background 150ms',
            lineHeight: 1,
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.color = '#EF4444'
            ;(e.currentTarget as HTMLElement).style.background = '#FEF2F2'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.color = '#D4D4D4'
            ;(e.currentTarget as HTMLElement).style.background = 'none'
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* ── 正文区 ── */}
      <div style={{ padding: '6px 16px 0' }}>

        {/* 主标题（双击编辑） */}
        {editing ? (
          <input
            autoFocus
            className="nodrag nopan"
            defaultValue={title}
            onBlur={e => saveTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') saveTitle((e.target as HTMLInputElement).value)
              if (e.key === 'Escape') setEditing(false)
            }}
            style={{
              width: '100%', border: 'none', outline: 'none',
              borderBottom: '1.5px solid #84A1DF',
              fontSize: '21px', fontWeight: 700, color: '#111827',
              background: 'transparent', padding: '0 0 2px',
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <div
            onDoubleClick={e => { e.stopPropagation(); setEditing(true) }}
            title="双击编辑名称"
            style={{
              fontSize: '21px', fontWeight: 700, lineHeight: 1.2,
              color: title ? '#111827' : '#CCCCCC',
              userSelect: 'none', cursor: 'default',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {title ? (
              <>
                {inlineSubtitle && subtitle && subtitle !== title ? `${title}(${subtitle})` : title}
              </>
            ) : (
              <span style={{ fontStyle: 'italic', fontSize: '16px', fontWeight: 400 }}>未命名</span>
            )}
          </div>
        )}

        {/* 副标题 */}
        {subtitle && !inlineSubtitle ? (
          <div style={{
            fontSize: '13px', color: '#ABABAB', marginTop: '3px', userSelect: 'none',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {subtitle}
          </div>
        ) : null}



        {/* 标签 Pills（最多 5 个） */}
        {tags.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '10px' }}>
            {tags.slice(0, 5).map(tag => (
              <span key={tag} style={{
                fontSize: '11px', color: '#6B7280',
                background: '#EFEFEC', borderRadius: '30px',
                padding: '3px 9px',
                userSelect: 'none',
              }}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* ── 底部：检查按钮 ── */}
      <div style={{ padding: '13px 16px 15px', marginTop: '2px' }}>
        <button
          className="nodrag nopan"
          onClick={e => { e.stopPropagation(); openAssetModal(id) }}
          style={{
            width: '100%',
            padding: '9px 0',
            background: '#1F2937',
            border: 'none',
            borderRadius: '11px',
            color: '#FFFFFF',
            fontSize: '12.5px',
            fontWeight: 600,
            letterSpacing: '0.06em',
            cursor: 'pointer',
            transition: 'opacity 180ms',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.82' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
        >
          检查
        </button>
      </div>

      {/* ── 生成中指示环 ── */}
      {loading && (
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: '18px',
          border: '2px solid #84A1DF',
          pointerEvents: 'none',
          animation: 'node-pulse 1.4s ease-in-out infinite',
        }} />
      )}

      <style>{`
        @keyframes node-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
