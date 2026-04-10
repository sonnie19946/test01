import React, { useState } from 'react'
import { useFlowStore } from '@/hooks/useFlowStore'
import { toast } from 'sonner'
import { ScriptNodeData } from '@/types/nodes'

export function ScriptPanel({ 
  nodeId, 
  data, 
  closeAssetModal,
  nodes
}: { 
  nodeId: string, 
  data: ScriptNodeData, 
  closeAssetModal: () => void,
  nodes: any[] 
}) {
  const { updateNodeData, extractByType, extractAssets } = useFlowStore()
  const [loadingTypes, setLoadingTypes] = useState<Set<string>>(new Set())

  const scriptText = data.text ?? ''
  const protagonist = data.protagonist ?? ''
  const title = protagonist ? `${protagonist}的故事` : '剧本全文'

  const BTN_BASE: React.CSSProperties = {
    border: 'none', borderRadius: '8px', cursor: 'pointer',
    fontFamily: 'inherit', fontWeight: 600, fontSize: '12.5px',
    letterSpacing: '0.05em', transition: 'opacity 160ms, background 160ms',
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '7px 14px',
  }

  const shotPoolNode = nodes.find((n: any) => n.type === 'shot_pool')
  type Shot = { id?: string; num?: number; title?: string }
  const allShots: Shot[] = Array.isArray(shotPoolNode?.data?.shots) ? shotPoolNode!.data.shots : []
  const doneShots = allShots.filter(s => s.title)

  const ACTIONS = [
    { type: 'character'  as const, label: '角色' },
    { type: 'appearance' as const, label: '形象' },
    { type: 'prop'       as const, label: '道具' },
    { type: 'scene'      as const, label: '场景' },
    { type: 'shot'       as const, label: '分镜' },
  ]
  const anyExtracting = loadingTypes.size > 0
  const isAllExtracting = loadingTypes.has('__all__')

  const doExtract = async (type: typeof ACTIONS[0]['type']) => {
    if (!scriptText.trim()) { toast.error('剧本内容为空'); return }
    setLoadingTypes(prev => new Set(prev).add(type))
    try { await extractByType(nodeId, scriptText, type) }
    finally { setLoadingTypes(prev => { const s = new Set(prev); s.delete(type); return s }) }
  }

  const doExtractAll = async () => {
    if (!scriptText.trim()) { toast.error('剧本内容为空'); return }
    setLoadingTypes(prev => new Set(prev).add('__all__'))
    try { await extractAssets(nodeId, scriptText) }
    finally { setLoadingTypes(prev => { const s = new Set(prev); s.delete('__all__'); return s }) }
  }

  const Spinner = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" strokeOpacity="0.2"/>
      <path d="M4 12a8 8 0 0 1 8-8" strokeLinecap="round"/>
    </svg>
  )

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)', zIndex: 50,
      }} onPointerDown={e => { if (e.target === e.currentTarget) closeAssetModal() }} />

      <div onPointerDown={e => { if (e.target === e.currentTarget) closeAssetModal() }} style={{
        position: 'fixed', inset: 0, zIndex: 51,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '16px',
          width: '100%', maxWidth: doneShots.length > 0 ? '980px' : '760px',
        }}>
          {doneShots.length > 0 && (
            <div style={{
              width: '240px', flexShrink: 0,
              background: '#FFFFFF', border: '1px solid #EBEBEB', borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', maxHeight: '80vh',
            }}>
              <div style={{
                padding: '14px 18px 12px', borderBottom: '1px solid #F3F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
              }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', userSelect: 'none' }}>分镜</span>
                <span style={{ fontSize: '11px', fontWeight: 500, color: '#D1D5DB', userSelect: 'none' }}>{doneShots.length} 个</span>
              </div>
              <div style={{ overflowY: 'auto', padding: '6px 0 8px' }}>
                {doneShots.map((s, i) => (
                  <div key={s.id ?? i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 18px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#D1D5DB', minWidth: '20px', flexShrink: 0, paddingTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                      {String(s.num ?? i + 1).padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: '12.5px', color: '#374151', lineHeight: 1.55, userSelect: 'none' }}>{s.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{
            flex: 1, background: '#FFFFFF', borderRadius: '16px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
            width: '100%', maxWidth: '760px', height: '80vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 28px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: '11px', color: '#ABABAB', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '3px' }}>剧本</div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>{title}</h2>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  style={{ ...BTN_BASE, background: '#F3F4F6', color: '#374151' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#E5E7EB' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#F3F4F6' }}
                  onClick={() => {
                    navigator.clipboard.writeText(scriptText)
                      .then(() => toast.success('剧本已复制'))
                      .catch(() => toast.error('复制失败'))
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  复制全文
                </button>
                <button
                  onClick={closeAssetModal}
                  title="关闭 (ESC)"
                  style={{
                    width: '28px', height: '28px', borderRadius: '6px',
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#9CA3AF', transition: 'background 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#374151' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'hidden', padding: '12px 24px 0' }}>
              <textarea
                value={scriptText}
                onChange={e => updateNodeData(nodeId, { text: e.target.value })}
                placeholder="在此粘贴或编辑剧本内容…"
                style={{
                  width: '100%', height: '100%', resize: 'none', outline: 'none',
                  border: 'none', borderRadius: '12px', padding: '32px 44px',
                  fontFamily: 'var(--font-ui, system-ui, -apple-system, sans-serif)',
                  fontSize: '16px', lineHeight: 2.1, letterSpacing: '0.04em',
                  color: '#374151', background: '#FFFFFF', boxSizing: 'border-box',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}
              />
            </div>

            <div style={{ flexShrink: 0, borderTop: '1px solid #F3F4F6' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', padding: '12px 16px 4px', gap: '6px' }}>
                {ACTIONS.map((a) => {
                  const busy = loadingTypes.has(a.type)
                  const disabled = (anyExtracting && !busy) || isAllExtracting
                  return (
                    <button key={a.type}
                      onClick={() => doExtract(a.type)}
                      disabled={disabled}
                      style={{
                        background: busy ? '#F3F4F6' : '#FFFFFF',
                        border: `1px solid ${busy ? '#D1D5DB' : '#E5E7EB'}`,
                        borderRadius: '8px', color: busy ? '#374151' : '#4B5563',
                        fontSize: '12.5px', fontWeight: 600, padding: '10px 4px',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.4 : 1, transition: 'all 160ms',
                        fontFamily: 'inherit', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px',
                      }}
                      onMouseEnter={e => {
                        if (disabled || busy) return
                        e.currentTarget.style.background = '#F9FAFB'
                        e.currentTarget.style.borderColor = '#D1D5DB'
                        e.currentTarget.style.color = '#111827'
                      }}
                      onMouseLeave={e => {
                        if (disabled || busy) return
                        e.currentTarget.style.background = '#FFFFFF'
                        e.currentTarget.style.borderColor = '#E5E7EB'
                        e.currentTarget.style.color = '#4B5563'
                      }}
                    >
                      {busy ? <Spinner /> : null}
                      <span>{busy ? '提取中' : `提取${a.label}`}</span>
                    </button>
                  )
                })}
              </div>

              <div style={{ padding: '8px 16px 20px' }}>
                <button
                  onClick={doExtractAll}
                  disabled={anyExtracting || isAllExtracting}
                  style={{
                    width: '100%', background: isAllExtracting ? '#F3F4F6' : '#1F2937',
                    border: 'none', borderRadius: '8px', color: isAllExtracting ? '#9CA3AF' : '#FFFFFF',
                    fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em', padding: '12px 0',
                    cursor: (anyExtracting || isAllExtracting) ? 'not-allowed' : 'pointer',
                    opacity: (anyExtracting && !isAllExtracting) ? 0.4 : 1, transition: 'all 160ms',
                    fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  }}
                  onMouseEnter={e => { if (!(anyExtracting || isAllExtracting)) e.currentTarget.style.opacity = '0.85' }}
                  onMouseLeave={e => { if (!(anyExtracting || isAllExtracting)) e.currentTarget.style.opacity = '1' }}
                >
                  {isAllExtracting && <Spinner />}
                  {isAllExtracting ? '正在提取全部资产...' : '提取全部'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
