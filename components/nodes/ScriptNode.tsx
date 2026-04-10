'use client'

import { NodeProps, Node } from '@xyflow/react'
import { useCallback, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { toast } from 'sonner'
import { useFlowStore } from '@/hooks/useFlowStore'

const HANDLE_STYLE = { background: 'transparent', border: 'none' }
const handleCls = 'custom-handle'

const SOURCE_HANDLES = [
  { id: 'extract_characters', top: '25%' },
  { id: 'extract_scenes',     top: '55%' },
  { id: 'extract_props',      top: '80%' },
]


type ScriptNodeData = { text?: string; loading?: boolean; protagonist?: string }
type ScriptNodeType = Node<ScriptNodeData, 'script'>

export default function ScriptNode({ id, selected, data }: NodeProps<ScriptNodeType>) {
  const { extractAssets, openAssetModal, nodes } = useFlowStore()
  const protagonist =
    (data.protagonist as string) ||
    (nodes.find(n => n.type === 'character' && (n.data as Record<string, any>).name)
      ?.data as Record<string, any>)?.name as string || ''

  const title     = protagonist ? `${protagonist}的故事` : '未命名故事'
  const charCount = (data.text ?? '').length
  const isActive  = selected || data.loading
  const anyLoading = data.loading

  const handleExtractAll = useCallback(async () => {
    const text = data.text?.trim()
    if (!text) { toast.error('请先输入剧本内容'); return }
    await extractAssets(id, text)
  }, [id, data.text, extractAssets])

  return (
    /* 外层透明容器：卡片 + 悬浮按钮行 */
    <div style={{ fontFamily: 'var(--font-ui, system-ui, sans-serif)', width: '270px' }}>

      {/* ── ReactFlow handles ── */}
      {SOURCE_HANDLES.map(h => (
        <Handle
          key={h.id} id={h.id}
          type="source" position={Position.Right}
          style={{ ...HANDLE_STYLE, top: h.top, transform: 'translateY(-50%)' }}
          className={handleCls}
        />
      ))}

      {/* ── 白色卡片 ── */}
      <div style={{
        background: '#FAFAF8',
        border: `1.5px solid ${isActive ? 'rgba(132,161,223,0.70)' : '#E8E8E4'}`,
        borderRadius: '18px',
        boxShadow: isActive
          ? '0 8px 28px -6px rgba(0,0,0,0.14), 0 0 0 2px rgba(132,161,223,0.22)'
          : '0 2px 12px -2px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        position: 'relative',
        transition: 'border-color 160ms, box-shadow 160ms',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 15px 0' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#ABABAB', letterSpacing: '0.04em', userSelect: 'none' }}>
            剧本
          </span>
          {charCount > 0 && (
            <span style={{ fontSize: '11px', color: '#C8C8C8', userSelect: 'none' }}>{charCount.toLocaleString()} 字</span>
          )}
        </div>

        {/* 主标题 */}
        <div style={{ padding: '6px 16px 0' }}>
          <div style={{ fontSize: '21px', fontWeight: 700, lineHeight: 1.2, color: protagonist ? '#111827' : '#CCCCCC', userSelect: 'none' }}>
            {title}
          </div>
        </div>

        {/* 检查 + 提取全部 */}
        <div style={{ padding: '13px 16px 15px', display: 'flex', gap: '8px' }}>
          <button className="nodrag nopan"
            onClick={e => { e.stopPropagation(); openAssetModal(id) }}
            style={{ flex: 1, padding: '9px 0', background: '#1F2937', border: 'none', borderRadius: '11px', color: '#FFFFFF', fontSize: '12.5px', fontWeight: 600, letterSpacing: '0.06em', cursor: 'pointer', transition: 'opacity 180ms', fontFamily: 'inherit' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.82' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
          >检查</button>

          <button className="nodrag nopan"
            onClick={e => { e.stopPropagation(); handleExtractAll() }}
            disabled={!!anyLoading}
            style={{ flex: 1, padding: '9px 0', background: 'transparent', border: '1.5px solid #E5E7EB', borderRadius: '11px', color: anyLoading ? '#9CA3AF' : '#4B5563', fontSize: '12.5px', fontWeight: 600, letterSpacing: '0.06em', cursor: anyLoading ? 'not-allowed' : 'pointer', transition: 'all 180ms', fontFamily: 'inherit' }}
            onMouseEnter={e => { if (!anyLoading) { (e.currentTarget as HTMLElement).style.borderColor = '#D1D5DB'; (e.currentTarget as HTMLElement).style.color = '#111827'; (e.currentTarget as HTMLElement).style.background = '#F9FAFB' } }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'; (e.currentTarget as HTMLElement).style.color = '#4B5563'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >{data.loading ? '提取中…' : '提取全部'}</button>
        </div>

        {/* 脉冲环 */}
        {anyLoading && (
          <div style={{ position: 'absolute', inset: 0, borderRadius: '18px', border: '2px solid #84A1DF', pointerEvents: 'none', animation: 'script-pulse 1.4s ease-in-out infinite' }} />
        )}
      </div>


      <style>{`
        @keyframes script-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </div>
  )
}
