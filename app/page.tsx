'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useBoardStore } from '@/hooks/useBoardStore'

function timeAgo(ts: number) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  return `${d} 天前`
}

function BoardCard({
  board,
  onOpen,
  onDelete,
  onRename,
}: {
  board: { id: string; name: string; createdAt: number; updatedAt: number }
  onOpen: () => void
  onDelete: () => void
  onRename: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(board.name)
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commitRename = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== board.name) onRename(trimmed)
    setEditing(false)
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false) }}
      style={{
        position: 'relative',
        background: '#FFFFFF',
        border: hovered ? '1.5px solid #84A1DF' : '1.5px solid #E4E4E7',
        borderRadius: '20px',
        cursor: 'pointer',
        transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)',
        boxShadow: hovered
          ? '0 12px 40px -6px rgba(132,161,223,0.2), 0 2px 8px rgba(0,0,0,0.04)'
          : '0 1px 4px rgba(0,0,0,0.05)',
        overflow: 'hidden',
      }}
    >
      {/* Thumbnail */}
      <div
        onClick={onOpen}
        style={{
          height: '200px',
          background: '#FBFBF9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          borderBottom: '1px solid #F0F0EE',
        }}
      >
        {/* Dot grid pattern */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(#E4E4E7 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          opacity: 0.6,
        }} />

        {/* Center icon */}
        <div style={{
          position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
        }}>
          <div style={{
            width: '48px', height: '48px',
            borderRadius: '12px',
            background: hovered ? 'rgba(132,161,223,0.12)' : 'rgba(132,161,223,0.07)',
            border: `1.5px solid rgba(132,161,223,${hovered ? '0.5' : '0.2'})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 200ms',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#84A1DF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="18" rx="2.5" />
              <path d="M8 3v18M16 3v18M2 8.5h20M2 15.5h20" strokeOpacity="0.7" />
            </svg>
          </div>
        </div>

        {/* Hover open hint */}
        {hovered && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(251,251,249,0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 2,
          }}>
            <span style={{
              padding: '7px 20px',
              background: '#84A1DF',
              borderRadius: '20px',
              color: '#FFFFFF',
              fontSize: '12.5px',
              fontWeight: 500,
              fontFamily: 'var(--font-ui, sans-serif)',
              letterSpacing: '0.02em',
              boxShadow: '0 4px 16px rgba(132,161,223,0.4)',
            }}>
              打开
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') { setDraft(board.name); setEditing(false) }
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%', padding: '2px 6px',
                background: 'rgba(132,161,223,0.07)',
                border: '1.5px solid #84A1DF',
                borderRadius: '6px',
                color: '#27272A',
                fontSize: '13.5px',
                fontFamily: 'var(--font-ui, sans-serif)',
                outline: 'none',
              }}
            />
          ) : (
            <div
              onClick={onOpen}
              style={{
                fontSize: '13.5px', fontWeight: 500,
                color: '#27272A',
                fontFamily: 'var(--font-ui, sans-serif)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {board.name}
            </div>
          )}
          <div style={{
            fontSize: '11px', color: '#A3A3A3',
            fontFamily: 'var(--font-ui, sans-serif)',
            marginTop: '2px',
          }}>
            {timeAgo(board.updatedAt)}
          </div>
        </div>

        {/* ⋮ menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
            style={{
              width: '28px', height: '28px',
              borderRadius: '8px',
              background: menuOpen ? '#F4F4F5' : 'transparent',
              border: 'none',
              color: '#A3A3A3',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 150ms',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#F4F4F5'
              ;(e.currentTarget as HTMLElement).style.color = '#27272A'
            }}
            onMouseLeave={(e) => {
              if (!menuOpen) {
                (e.currentTarget as HTMLElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLElement).style.color = '#A3A3A3'
              }
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
            </svg>
          </button>

          {menuOpen && (
            <div
              style={{
                position: 'absolute', right: 0, bottom: '36px',
                background: '#FFFFFF',
                border: '1px solid #E4E4E7',
                borderRadius: '10px',
                padding: '4px',
                zIndex: 100,
                minWidth: '130px',
                boxShadow: '0 8px 32px -4px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownItem label="重命名" onClick={() => { setMenuOpen(false); setEditing(true) }} />
              <div style={{ height: '1px', background: '#F4F4F5', margin: '3px 6px' }} />
              <DropdownItem label="删除" danger onClick={() => { setMenuOpen(false); onDelete() }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DropdownItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  const [h, setH] = useState(false)
  return (
    <button
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        width: '100%', display: 'block',
        padding: '7px 12px', border: 'none', borderRadius: '7px',
        background: h ? (danger ? 'rgba(220,38,38,0.07)' : '#F4F4F5') : 'transparent',
        color: danger ? (h ? '#DC2626' : '#8C8C8C') : (h ? '#27272A' : '#8C8C8C'),
        fontSize: '13px', textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'var(--font-ui, sans-serif)',
        transition: 'all 100ms',
      }}
    >
      {label}
    </button>
  )
}

export default function HomePage() {
  const router = useRouter()
  const { boards, createBoard, deleteBoard, renameBoard } = useBoardStore()
  const [creating, setCreating] = useState(false)

  const handleCreate = () => {
    setCreating(true)
    const id = createBoard()
    setTimeout(() => router.push(`/project/${id}`), 100)
  }

  const handleDelete = (id: string) => {
    if (boards.length <= 1) return
    if (!confirm('确认删除这个项目？此操作无法撤销。')) return
    deleteBoard(id)
  }

  return (
    <main style={{
      width: '100vw', minHeight: '100vh',
      background: '#FBFBF9',
      fontFamily: 'var(--font-ui, sans-serif)',
    }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 64px',
        height: '72px',
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #E4E4E7',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '16px', fontWeight: 700,
            color: '#000000', letterSpacing: '0.04em',
            fontFamily: 'var(--font-ui, sans-serif)',
          }}>
            SMINDS
          </span>
        </div>


      </header>

      {/* Content */}
      <div style={{ padding: '56px 64px' }}>
        {/* Section header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '32px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '13px', fontWeight: 600,
              color: '#27272A',
            }}>
              全部项目
            </span>
            <span style={{
              fontSize: '11.5px',
              background: '#F4F4F5',
              color: '#8C8C8C',
              borderRadius: '20px',
              padding: '1px 8px',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {boards.length}
            </span>
          </div>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
          gap: '24px',
        }}>
          {boards.map((board) => (
            <BoardCard
              key={board.id}
              board={board}
              onOpen={() => router.push(`/project/${board.id}`)}
              onDelete={() => handleDelete(board.id)}
              onRename={(name) => renameBoard(board.id, name)}
            />
          ))}

          {/* Ghost add card */}
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              minHeight: '272px',
              background: 'transparent',
              border: '1.5px dashed #E4E4E7',
              borderRadius: '16px',
              cursor: creating ? 'not-allowed' : 'pointer',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '10px',
              color: '#C4C4C4',
              transition: 'all 200ms',
              fontFamily: 'var(--font-ui, sans-serif)',
            }}
            onMouseEnter={(e) => {
              if (!creating) {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = '#84A1DF'
                el.style.color = '#84A1DF'
                el.style.background = 'rgba(132,161,223,0.04)'
              }
            }}
            onMouseLeave={(e) => {
              if (!creating) {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = '#E4E4E7'
                el.style.color = '#C4C4C4'
                el.style.background = 'transparent'
              }
            }}
          >
            <div style={{
              width: '40px', height: '40px',
              borderRadius: '10px',
              border: '1.5px dashed currentColor',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 500 }}>新建画板</span>
          </button>
        </div>
      </div>
    </main>
  )
}
