'use client'

import { useEffect, useRef } from 'react'
import { useFlowStore } from '@/hooks/useFlowStore'

interface NodeContextMenuProps {
  nodeId: string
  x: number
  y: number
  onClose: () => void
}

interface MenuItemProps {
  label: string
  danger?: boolean
  onClick: () => void
}

function MenuItem({ label, danger, onClick }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        padding: '8px 14px',
        background: 'none',
        border: 'none',
        textAlign: 'left',
        color: danger ? 'var(--accent-danger)' : 'var(--text-primary)',
        fontFamily: 'var(--font-ui, sans-serif)',
        fontSize: '12px',
        letterSpacing: '0.04em',
        cursor: 'pointer',
        borderRadius: 'var(--radius-sm)',
        transition: 'background var(--duration-fast)',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger
          ? 'var(--accent-danger-dim)'
          : 'var(--bg-elevated)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'none'
      }}
    >
      {label}
    </button>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
}

export default function NodeContextMenu({ nodeId, x, y, onClose }: NodeContextMenuProps) {
  const deleteNode     = useFlowStore((s) => s.deleteNode)
  const setEdges       = useFlowStore((s) => s.setEdges)
  const edges          = useFlowStore((s) => s.edges)
  const ref            = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape
  useEffect(() => {
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') onClose()
        return
      }
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', handler)
    }
  }, [onClose])

  // Clamp to viewport so menu never clips off-screen
  const menuW = 200
  const menuH = 140
  const cx = Math.min(x, window.innerWidth  - menuW - 8)
  const cy = Math.min(y, window.innerHeight - menuH - 8)

  const handleDisconnect = () => {
    setEdges(edges.filter((e) => e.source !== nodeId && e.target !== nodeId))
    onClose()
  }

  const handleDelete = () => {
    deleteNode(nodeId)
    onClose()
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(nodeId)
    onClose()
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: cy,
        left: cx,
        width: menuW,
        background: 'var(--glass-bg)',
        backdropFilter: 'var(--glass-blur)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-elevated)',
        padding: '4px',
        zIndex: 500,
      }}
    >
      <MenuItem label="断开所有连接" onClick={handleDisconnect} />
      <MenuItem label="复制节点 ID"  onClick={handleCopyId} />
      <Divider />
      <MenuItem label="删除节点" danger onClick={handleDelete} />
    </div>
  )
}
