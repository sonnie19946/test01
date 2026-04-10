'use client'
import { NodeProps, Node, Handle, Position } from '@xyflow/react'
import { useCallback } from 'react'
import { useFlowStore } from '@/hooks/useFlowStore'

// ── Types (exported so modal can share) ───────────────────────
export type AssetRef = { nodeId: string; type: string; name: string }
export type ShotItem = {
  id: string; num: number; title: string; plot?: string
  camera?: string; action?: string; emotion?: string; prompt?: string
  status: 'pending' | 'generating' | 'done'
  refs: AssetRef[]; note?: string; imageUrl?: string
}
export type ShotPoolData = { shots: ShotItem[]; loading?: boolean }
type ShotPoolNodeType = Node<ShotPoolData, 'shot_pool'>

const HANDLE_STYLE = { background: 'transparent', border: 'none', width: '10px', height: '10px' }

// ── Shot Card (pool view, minimal) ─────────────────────────────
function PoolShotCard({ shot, onCheck }: { shot: ShotItem; onCheck: () => void }) {
  const isGenerating = shot.status === 'generating'
  const isDone = shot.status === 'done'
  const isPending = shot.status === 'pending'

  return (
    <div style={{
      background: isGenerating ? '#F0F4FF' : '#FFFFFF',
      border: `1px solid ${isGenerating ? 'rgba(132,161,223,0.5)' : '#EBEBEB'}`,
      borderRadius: '10px', overflow: 'hidden', transition: 'all 150ms',
      display: 'flex', flexDirection: 'column', height: '100%',   /* ← 等高关键 */
    }}>
      <div style={{ padding: '10px 12px 10px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Number + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#ABABAB', letterSpacing: '0.06em' }}>
            {String(shot.num).padStart(2, '0')}
          </span>
          {isGenerating && (
            <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#84A1DF', animation: `pool-bounce 1s ease ${i * 0.15}s infinite` }} />
              ))}
            </div>
          )}
          {isDone && shot.title && (
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {shot.title}
            </span>
          )}
          {isPending && <span style={{ fontSize: '11.5px', color: '#D1D5DB' }}>等待生成…</span>}
        </div>

        {/* plot 占据剩余空间，按钮自然沉底 */}
        <div style={{ flex: 1 }}>
          {isDone && shot.plot && (
            <p style={{ fontSize: '11.5px', color: '#6B7280', lineHeight: 1.65, margin: '0 0 8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              情节描述：{shot.plot}
            </p>
          )}
        </div>

        {isDone && (
          <button
            className="nodrag nopan"
            onClick={e => { e.stopPropagation(); onCheck() }}
            style={{
              width: '100%', padding: '6px 0',
              background: '#1F2937', border: 'none', borderRadius: '7px',
              color: '#FFFFFF', fontSize: '11.5px', fontWeight: 600,
              letterSpacing: '0.05em', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'opacity 160ms', flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.82' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
          >
            检查
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main ShotPoolNode ───────────────────────────────────────────
export default function ShotPoolNode({ id, selected, data }: NodeProps<ShotPoolNodeType>) {
  const { openShotItemModal } = useFlowStore()
  const shots: ShotItem[] = Array.isArray(data.shots) ? data.shots : []
  const done = shots.filter(s => s.status === 'done').length

  const handleCheck = useCallback((idx: number) => {
    openShotItemModal(id, idx)
  }, [id, openShotItemModal])

  return (
    <div style={{ position: 'relative', display: 'inline-block', fontFamily: 'var(--font-ui, system-ui, sans-serif)' }}>
      <Handle type="target" position={Position.Left} id="inputs"
        style={{ ...HANDLE_STYLE, top: '50%', transform: 'translateY(-50%)' }}
        className="custom-handle"
      />

      <div style={{
        background: '#F2F1EE',
        border: `1.5px solid ${selected ? 'rgba(132,161,223,0.70)' : '#DEDCD5'}`,
        borderRadius: '18px', width: '620px',
        boxShadow: selected ? '0 8px 28px -6px rgba(0,0,0,0.14),0 0 0 2px rgba(132,161,223,0.22)' : '0 2px 12px -2px rgba(0,0,0,0.06)',
        transition: 'border-color 160ms,box-shadow 160ms',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 18px 11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E0DB' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#ABABAB', letterSpacing: '0.04em' }}>分镜池</div>
            {shots.length > 0 && (
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#1A1A1A', marginTop: '2px', letterSpacing: '-0.01em' }}>
                {done} <span style={{ fontWeight: 400, color: '#9CA3AF' }}>/ {shots.length} 完成</span>
              </div>
            )}
          </div>
          {data.loading && shots.length === 0 && (
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {[0, 1, 2].map(i => <div key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#84A1DF', animation: `pool-bounce 1s ease ${i * 0.15}s infinite` }} />)}
            </div>
          )}
        </div>

        {/* Grid */}
        <div style={{ padding: '14px 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {shots.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '36px 0', color: '#C8C8C6', fontSize: '12.5px' }}>
              {data.loading ? 'AI 规划分镜序列…' : '连接资产节点后自动生成分镜'}
            </div>
          )}
          {shots.map((shot, i) => (
            <PoolShotCard key={shot.id} shot={shot} onCheck={() => handleCheck(i)} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pool-bounce {
          0%,100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(-4px); opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
