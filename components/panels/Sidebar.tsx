'use client'

import { Node } from '@xyflow/react'
import { getAssetDisplayName } from '@/lib/getAssetDisplayName'
import { useState } from 'react'
import PromptConfigModal from '@/components/modals/PromptConfigModal'
import SettingsModal from '@/components/modals/SettingsModal'

interface SidebarProps {
  nodeGroups: Record<string, Node[]>
  typeLabels: Record<string, string>
  focusNode: (nodeId: string) => void
}

const TYPE_ORDER = ['script', 'character', 'scene', 'prop', 'appearance', 'shot', 'image', 'prompt']

function SidebarItem({ label, onClick, muted }: { label: string; onClick: () => void; muted?: boolean }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center',
        padding: '0 20px 0 44px',
        height: '30px', cursor: 'pointer', gap: '7px',
        color: muted ? '#C0C0C0' : '#9CA3AF',
        transition: 'color 100ms',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.color = '#111827'
        ;(e.currentTarget as HTMLElement).style.backgroundColor = '#F9F9F7'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.color = muted ? '#C0C0C0' : '#9CA3AF'
        ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
      }}
    >
      <span style={{ width: '12px', height: '1px', background: '#E0E0DC', flexShrink: 0 }} />
      <span style={{ fontSize: '12.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  )
}


export default function Sidebar({ nodeGroups, typeLabels, focusNode }: SidebarProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [promptConfigOpen, setPromptConfigOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const toggle = (type: string) =>
    setExpanded(prev => ({ ...prev, [type]: !prev[type] }))

  const sortedTypes = TYPE_ORDER.filter(t => nodeGroups[t]?.length > 0)
  const extraTypes  = Object.keys(nodeGroups).filter(t => !TYPE_ORDER.includes(t))
  const allTypes    = [...sortedTypes, ...extraTypes]

  return (
    <div
      style={{
        position: 'fixed', left: 0, top: 0,
        width: '210px', height: '100%',
        background: '#FFFFFF',
        borderRight: '1px solid #EBEBEB',
        display: 'flex', flexDirection: 'column',
        zIndex: 10,
        fontFamily: 'var(--font-ui, system-ui, sans-serif)',
        /* overflow-hidden 去掉 —— 放到子滚动区，避免裁掉title descender */
      }}
    >
      {/* ── 顶部标题 ── */}
      <div style={{
        flexShrink: 0,
        padding: '0 20px',
        /* 用 minHeight 代替固定 height，让行高自然撑开，descender 不被裁 */
        minHeight: '64px',
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid #EBEBEB',
      }}>
        <span style={{
          fontSize: '13px', fontWeight: 600,
          color: '#1A1A1A', letterSpacing: '-0.01em',
          lineHeight: '1.6',          /* 行高充足，descender 不被裁 */
          paddingBottom: '1px',        /* 额外保护 */
          display: 'inline-block',     /* padding-bottom 对 inline 无效，需 block */
          userSelect: 'none',
        }}>
          Production Design
        </span>
      </div>

      {/* ── 节点分组列表（独立滚动） ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {allTypes.map(type => {
          const groupNodes = nodeGroups[type] || []
          const isOpen = !!expanded[type]
          const label  = typeLabels[type] || type

          return (
            <div key={type}>
              {/* ── 分类行 —— 纯文本，无图标 ── */}
              <div
                onClick={() => toggle(type)}
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: '0 20px',
                  height: '38px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  gap: '8px',
                  /* 不设 backgroundColor 在 style 里，用 onMouse 控制 */
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = '#F5F5F3'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                }}
              >
                {/* 展开/折叠指示 — 用 + / − 而不是 icon */}
                <span style={{
                  fontSize: '14px', lineHeight: 1,
                  color: isOpen ? '#1A1A1A' : '#ABABAB',
                  fontWeight: 300,
                  width: '12px', flexShrink: 0,
                  transition: 'color 120ms',
                }}>
                  {isOpen ? '−' : '+'}
                </span>

                {/* 分类名 */}
                <span style={{
                  flex: 1,
                  fontSize: '13.5px',
                  fontWeight: isOpen ? 600 : 400,
                  color: isOpen ? '#111827' : '#6B7280',
                  transition: 'color 120ms, font-weight 120ms',
                }}>
                  {label}
                </span>

                {/* 数量（muted small） */}
                <span style={{
                  fontSize: '11px',
                  color: '#C0C0C0',
                  fontWeight: 400,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {groupNodes.length}
                </span>
              </div>

              {/* ── 子节点列表 ── */}
              {isOpen && (
                <div style={{ paddingBottom: '4px' }}>
                  {groupNodes.map(node => {
                    const d = node.data as Record<string, any>

                    // ── 分镜池：展开内部所有分镜 ──
                    if (type === 'shot_pool') {
                      const shots: Array<{ num?: number; title?: string }> =
                        Array.isArray(d?.shots) ? d.shots : []
                      const sorted = [...shots].sort((a, b) => (a.num ?? 0) - (b.num ?? 0))
                      if (sorted.length === 0) {
                        return (
                          <SidebarItem key={node.id} label="（暂无分镜）" muted
                            onClick={() => focusNode(node.id)} />
                        )
                      }
                      return sorted.map((s, i) => {
                        const rawTitle = s.title || '未命名分镜'
                        // 去掉 title 中已包含的序号前缀，如 "[01 工业巨兽...]" → "工业巨兽..."
                        const cleanTitle = rawTitle.replace(/^\[?\d+\s*/, '').replace(/\]$/, '')
                        const seq = String(s.num ?? i + 1).padStart(2, '0')
                        return (
                          <SidebarItem
                            key={`${node.id}-${i}`}
                            label={`${seq} ${cleanTitle || '未命名分镜'}`}
                            onClick={() => focusNode(node.id)}
                          />
                        )
                      })
                    }

                    // ── 其余节点：单行 ──
                    const scriptName = (() => {
                      if (type !== 'script') return null
                      const protagonist = (d?.protagonist as string) ||
                        ((nodeGroups['character']?.[0]?.data as Record<string, any>)?.name as string) || ''
                      return protagonist ? `${protagonist}的故事` : '未命名剧本'
                    })()
                    const name = scriptName ?? (
                      type === 'appearance'
                        ? getAssetDisplayName('appearance', d)
                        : String(d?.characterName || d?.versionName || d?.name || d?.title || d?.label || `未命名 ${label}`)
                    )
                    return (
                      <SidebarItem key={node.id} label={name} onClick={() => focusNode(node.id)} />
                    )
                  })}
                </div>
              )}

            </div>
          )
        })}

        {/* 空状态 */}
        {allTypes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 16px 0' }}>
            <p style={{ fontSize: '13px', color: '#C8C8C6' }}>画布中暂无节点</p>
            <p style={{ fontSize: '12px', color: '#C8C8C6', marginTop: '4px' }}>右键画布添加节点</p>
          </div>
        )}
      </div>

      {/* ── 底部：设置入口 ── */}
      <div style={{
        flexShrink: 0,
        borderTop: '1px solid #EBEBEB',
        padding: '10px 16px',
        display: 'flex', flexDirection: 'column', gap: '2px',
      }}>
        {/* API Key 设置 */}
        <div
          onClick={() => setSettingsOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '9px 12px', borderRadius: '10px',
            cursor: 'pointer', transition: 'background 120ms',
            userSelect: 'none',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F5F5F3' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
          </svg>
          <span style={{ fontSize: '12.5px', color: '#6B7280', fontWeight: 500 }}>
            API Key 设置
          </span>
        </div>

        {/* 提示词配置 */}
        <div
          onClick={() => setPromptConfigOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '9px 12px', borderRadius: '10px',
            cursor: 'pointer', transition: 'background 120ms',
            userSelect: 'none',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F5F5F3' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span style={{ fontSize: '12.5px', color: '#6B7280', fontWeight: 500 }}>
            提示词配置
          </span>
        </div>
      </div>

      {/* ── 弹窗 ── */}
      <PromptConfigModal open={promptConfigOpen} onClose={() => setPromptConfigOpen(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}