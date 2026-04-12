'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useFlowStore } from '@/hooks/useFlowStore'
import { getAssetDisplayName } from '@/lib/getAssetDisplayName'
import { getTemplate, sanitizePromptText } from '@/lib/promptTemplates'
import { toast } from 'sonner'
import type { ShotItem, AssetRef } from '@/components/nodes/ShotPoolNode'

const TYPE_LBL: Record<string, string> = { character: '角色', appearance: '角色形象', scene: '场景', prop: '道具' }

// ── Chip style（行内 @mention）──────────────────────────────────
const CHIP_STYLE = 'display:inline-block;background:#EEF2FF;color:#4F6DC8;border-radius:4px;padding:0 5px 1px;font-weight:600;cursor:default;user-select:none;font-size:12.5px;line-height:1.65'

// ── ActionButton ────────────────────────────────────────────────
function ActionButton({ onClick, icon, label, disabled, loading, primary }: {
  onClick?: () => void; icon: React.ReactNode; label: string
  disabled?: boolean; loading?: boolean; primary?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '8px 16px', borderRadius: '8px',
      border: primary ? 'none' : '1px solid #E5E7EB',
      background: primary ? '#4F6DC8' : '#FFFFFF',
      color: primary ? '#FFFFFF' : '#374151',
      fontSize: '13px', fontWeight: 500,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'background 0.15s', fontFamily: 'inherit',
    }}
      onMouseEnter={e => { if (disabled) return; (e.currentTarget as HTMLElement).style.background = primary ? '#3D5AB5' : '#F9FAFB' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = primary ? '#4F6DC8' : '#FFFFFF' }}
    >
      {loading
        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M4 12a8 8 0 0 1 8-8" strokeLinecap="round" />
          </svg>
        : icon}
      {label}
    </button>
  )
}

// ── @Mention popup ──────────────────────────────────────────────
function MentionPopup({ assets, query, onSelect, anchor }: {
  assets: Array<{ id: string; type?: string; name: string }>
  query: string; onSelect: (a: { id: string; type?: string; name: string }) => void
  anchor: DOMRect | null
}) {
  const filtered = assets.filter(a => a.name.toLowerCase().includes(query.toLowerCase()))
  if (!filtered.length || !anchor) return null
  return (
    <div style={{
      position: 'fixed', zIndex: 9999, top: anchor.bottom + 4, left: anchor.left,
      background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '160px', maxHeight: '200px',
      overflowY: 'auto', padding: '4px 0',
    }}>
      {filtered.map(a => (
        <div key={a.id}
          onMouseDown={e => { e.preventDefault(); onSelect(a) }}
          style={{ padding: '7px 12px', cursor: 'pointer', fontSize: '12.5px', color: '#374151', display: 'flex', alignItems: 'center', gap: '7px' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F5F5F3' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          <span style={{ fontSize: '9px', color: '#9CA3AF', background: '#F3F4F6', borderRadius: '3px', padding: '1px 4px' }}>
            {TYPE_LBL[a.type || ''] || String(a.type)}
          </span>
          {a.name}
        </div>
      ))}
    </div>
  )
}

// ── Plain input / textarea field ────────────────────────────────
function Field({ label, value, onChange, multiline }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean
}) {
  const base: React.CSSProperties = {
    width: '100%', padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: '8px',
    fontSize: '13px', color: '#1F2937', fontFamily: 'var(--font-ui, system-ui, sans-serif)',
    lineHeight: 1.65, outline: 'none', resize: 'none', background: '#FFFFFF',
    boxSizing: 'border-box', transition: 'border-color 150ms',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.04em' }}>{label}</div>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} style={base}
            onFocus={e => { (e.target as HTMLElement).style.borderColor = '#6B83CC' }}
            onBlur={e => { (e.target as HTMLElement).style.borderColor = '#E5E7EB' }} />
        : <input value={value} onChange={e => onChange(e.target.value)} style={{ ...base, height: '38px' }}
            onFocus={e => { (e.target as HTMLElement).style.borderColor = '#6B83CC' }}
            onBlur={e => { (e.target as HTMLElement).style.borderColor = '#E5E7EB' }} />
      }
    </div>
  )
}

// ── contenteditable 文本框（支持行内 @chip）─────────────────────
function MentionField({ label, initialValue, onChangeText, assetNodes, rows = 3, insertTrigger }: {
  label: string
  initialValue: string
  onChangeText: (v: string) => void
  assetNodes: Array<{ id: string; type?: string; name: string }>
  rows?: number
  insertTrigger?: React.MutableRefObject<((a: { id: string; type?: string; name: string }) => void) | null>
}) {
  const divRef = useRef<HTMLDivElement>(null)
  const [showMention, setShowMention] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const initialized = useRef(false)
  // 保存 @ 触发时的精确 Range，插入 chip 时直接用它删除，彻底避免 DOM 碎片化导致找不到 @
  const mentionRange = useRef<Range | null>(null)

  // 将文本（含 @name 标记）转换为 HTML，单行文节点 + chip
  const textToHtml = useCallback((text: string) => {
    if (!text || assetNodes.length === 0) return text || ''
    // 按名称长度降序排列，防止短名（如"面包师"）抢走长名（如"胖面包师(面包师)"）
    const sorted = [...assetNodes].sort((a, b) => b.name.length - a.name.length)
    // 构建精确匹配正则：@名称1|@名称2|...（转义特殊字符）
    const escaped = sorted.map(a => '@' + a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const regex = new RegExp(`(${escaped.join('|')})`, 'g')
    return text.replace(regex, (match) => {
      const name = match.slice(1) // 去掉 @
      const asset = sorted.find(a => a.name === name)
      if (!asset) return match
      return `<span contenteditable="false" data-mention="1" data-id="${asset.id}" data-type="${asset.type || ''}" data-name="${name}" style="${CHIP_STYLE}">@${name}</span>`
    })
  }, [assetNodes])

  // 首次初始化 contenteditable 内容
  useEffect(() => {
    if (initialized.current || !divRef.current) return
    initialized.current = true
    divRef.current.innerHTML = textToHtml(initialValue)
  }, [])

  // 从 DOM 提取纯文本（chip → @name）
  const getPlainText = (): string => {
    if (!divRef.current) return ''
    let text = ''
    divRef.current.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || ''
      } else {
        const el = node as HTMLElement
        if (el.dataset?.mention) text += `@${el.dataset.name}`
        else text += el.textContent || ''
      }
    })
    return text
  }

  const checkMentionTrigger = () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    const node = range.startContainer
    if (node.nodeType !== Node.TEXT_NODE) { setShowMention(false); mentionRange.current = null; return }
    const textBefore = (node.textContent || '').slice(0, range.startOffset)
    const lastAt = textBefore.lastIndexOf('@')
    if (lastAt !== -1) {
      if (lastAt === 0 || !/[a-zA-Z0-9_]/.test(textBefore[lastAt - 1])) {
        const query = textBefore.slice(lastAt + 1)
        if (!query.includes(' ') && !query.includes('\n')) {
          setMentionQuery(query); setShowMention(true)
          // 精确保存从 @ 到光标的 Range，插入时直接 deleteContents
          const saved = document.createRange()
          saved.setStart(node, lastAt)
          saved.setEnd(node, range.startOffset)
          mentionRange.current = saved
          const r = range.cloneRange(); r.collapse(true)
          setAnchor(r.getBoundingClientRect())
          return
        }
      }
    }
    setShowMention(false)
    mentionRange.current = null
  }

  const handleInput = () => {
    onChangeText(getPlainText())
    checkMentionTrigger()
  }

  // 插入 chip 到当前光标位置
  const insertChip = (asset: { id: string; type?: string; name: string }, isFromMention: boolean = true) => {
    const sel = window.getSelection()
    if (!sel) return

    let range: Range

    if (isFromMention && mentionRange.current) {
      // ✅ 核心修复：直接用检测时保存的精确 Range 删除 @query
      range = mentionRange.current
      range.deleteContents()
      mentionRange.current = null
    } else {
      // 拖入或面板点击：用当前光标位置，尝试清理可能存在的 @
      if (sel.rangeCount === 0) return
      range = sel.getRangeAt(0)
      let textNode = range.startContainer
      let startOffset = range.startOffset
      if (textNode.nodeType !== Node.TEXT_NODE && startOffset > 0) {
        const prev = textNode.childNodes[startOffset - 1]
        if (prev?.nodeType === Node.TEXT_NODE) { textNode = prev; startOffset = textNode.textContent?.length || 0 }
      }
      if (textNode.nodeType === Node.TEXT_NODE) {
        const txt = (textNode.textContent || '').slice(0, startOffset)
        const at = txt.lastIndexOf('@')
        if (at !== -1) {
          const q = txt.slice(at + 1).replace(/[\s\u00A0]+$/, '')
          if (!q.includes(' ') && !q.includes('\n')) {
            (textNode as Text).deleteData(at, startOffset - at)
            range.setStart(textNode, at); range.collapse(true)
          }
        }
      }
    }

    // 创建 chip span
    const chip = document.createElement('span')
    chip.contentEditable = 'false'
    chip.dataset.mention = '1'
    chip.dataset.id = asset.id
    chip.dataset.type = asset.type || ''
    chip.dataset.name = asset.name
    chip.setAttribute('style', CHIP_STYLE)
    chip.textContent = `@${asset.name}`
    range.insertNode(chip)

    // 光标移到 chip 后加空格
    const space = document.createTextNode(' ')
    range.setStartAfter(chip)
    range.insertNode(space)
    range.setStartAfter(space)
    range.collapse(true)
    sel.removeAllRanges(); sel.addRange(range)

    setShowMention(false)
    onChangeText(getPlainText())
    divRef.current?.focus()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    try {
      const raw = e.dataTransfer.getData('application/json')
      const asset = JSON.parse(raw)
      if (asset?.nodeId) {
        // 先尝试通过鼠标位置获取真实的丢入光标点位以避免 DOM 结构错位
        let range: Range | null = null
        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(e.clientX, e.clientY)
        } else if ((document as any).caretPositionFromPoint) {
            const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY)
            if (pos && pos.offsetNode) {
                range = document.createRange()
                range.setStart(pos.offsetNode, pos.offset)
                range.collapse(true)
            }
        }
        
        const sel = window.getSelection()
        if (range && sel) {
            sel.removeAllRanges()
            sel.addRange(range)
        }
        
        const a = assetNodes.find(n => n.id === asset.nodeId)
        if (a) insertChip(a, false)
      }
    } catch {}
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ position: 'relative' }}>
        <div
          ref={divRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={e => { if (e.key === 'Escape' && showMention) setShowMention(false) }}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          style={{
            minHeight: '40px', padding: '8px 12px',
            border: '1px solid #E5E7EB', borderRadius: '8px',
            fontSize: '13px', color: '#1F2937',
            fontFamily: 'var(--font-ui, system-ui, sans-serif)',
            lineHeight: 1.65, outline: 'none',
            background: '#FFFFFF', boxSizing: 'border-box',
            wordBreak: 'break-word', whiteSpace: 'pre-wrap',
            transition: 'border-color 150ms', cursor: 'text',
          }}
          onFocus={e => { 
            (e.currentTarget as HTMLElement).style.borderColor = '#6B83CC' 
            if (insertTrigger) insertTrigger.current = (a) => insertChip(a, false)
          }}
          onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB' }}
        />
        {showMention && (
          <MentionPopup assets={assetNodes} query={mentionQuery} onSelect={a => insertChip(a, true)} anchor={anchor} />
        )}
      </div>
    </div>
  )
}

// ── Left floating asset panel ────────────────────────────────────
function AssetPanel({ assets, onAdd, aiRefs }: {
  assets: Array<{ id: string; type?: string; name: string }>
  onAdd: (a: { id: string; type?: string; name: string }) => void
  aiRefs?: Set<string>  // nodeId 集合
}) {
  const aiCount = aiRefs ? assets.filter(n => aiRefs.has(n.id)).length : 0
  return (
    <div onClick={e => e.stopPropagation()} style={{
      width: '210px', background: '#FFFFFF',
      border: '1px solid rgba(0,0,0,0.07)', borderRadius: '14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.1)', padding: '8px 0 10px',
      marginRight: '14px', flexShrink: 0,
      display: 'flex', flexDirection: 'column', overflow: 'hidden'
    }}>
      <div style={{ padding: '7px 14px 5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: '10px', fontWeight: 600, color: '#C0C0C0', letterSpacing: '0.08em' }}>可引用资产</span>
        {aiCount > 0 && (
          <span style={{ fontSize: '9px', fontWeight: 600, color: '#4F6DC8', background: '#EEF2FF', borderRadius: '4px', padding: '1px 5px' }}>
            AI 引用 {aiCount}
          </span>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {assets.length === 0
          ? <div style={{ padding: '4px 14px', fontSize: '11.5px', color: '#D1D5DB' }}>暂无资产</div>
          : assets.map(n => {
            const isAIRef = aiRefs?.has(n.id)
            return (
              <div key={n.id} draggable
                onDragStart={e => {
                  e.stopPropagation()
                  e.dataTransfer.setData('text/plain', `@${n.name}`)
                  e.dataTransfer.setData('application/json', JSON.stringify({ nodeId: n.id, type: n.type, name: n.name }))
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={e => { e.stopPropagation(); onAdd(n) }}
                style={{
                  padding: '7px 14px', cursor: 'grab', display: 'flex', alignItems: 'center', gap: '7px',
                  transition: 'background 80ms',
                  background: isAIRef ? 'rgba(79,109,200,0.05)' : 'transparent',
                  borderLeft: isAIRef ? '2px solid #4F6DC8' : '2px solid transparent',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isAIRef ? 'rgba(79,109,200,0.1)' : '#F5F5F3' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isAIRef ? 'rgba(79,109,200,0.05)' : 'transparent' }}
              >
                <span style={{ fontSize: '9px', fontWeight: 600, color: isAIRef ? '#4F6DC8' : '#9CA3AF', background: isAIRef ? '#EEF2FF' : '#F3F4F6', borderRadius: '3px', padding: '1px 4px', flexShrink: 0 }}>
                  {TYPE_LBL[n.type || ''] || String(n.type)}
                </span>
                <span style={{ fontSize: '12px', color: isAIRef ? '#1E3A8A' : '#374151', fontWeight: isAIRef ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {n.name}
                </span>
                {isAIRef && (
                  <span title="AI 已在本分镜引用此资产" style={{ fontSize: '9px', color: '#4F6DC8', flexShrink: 0 }}>✦</span>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}

// ── Right floating shot navigation panel ────────────────────
function ShotNavPanel({ shots, currentIndex, onSelect }: {
  shots: ShotItem[]
  currentIndex: number
  onSelect: (index: number) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)

  // 自动滚动到当前选中的分镜
  useEffect(() => {
    if (!listRef.current) return
    const activeEl = listRef.current.children[currentIndex] as HTMLElement
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [currentIndex])

  return (
    <div onClick={e => e.stopPropagation()} style={{
      width: '180px', background: '#FFFFFF',
      border: '1px solid rgba(0,0,0,0.07)', borderRadius: '14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
      marginLeft: '14px', flexShrink: 0,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      maxHeight: '82vh',
    }}>
      <div style={{
        padding: '10px 14px 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, borderBottom: '1px solid #F3F4F6',
      }}>
        <span style={{ fontSize: '10px', fontWeight: 600, color: '#C0C0C0', letterSpacing: '0.08em' }}>分镜导航</span>
        <span style={{ fontSize: '9px', fontWeight: 500, color: '#D1D5DB' }}>{shots.length} 个</span>
      </div>
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {shots.map((s, i) => {
          const isActive = i === currentIndex
          const seq = String(s.num ?? i + 1).padStart(2, '0')
          const rawTitle = s.title || '未命名'
          const cleanTitle = rawTitle.replace(/^\[?\d+\s*/, '').replace(/\]$/, '') || '未命名'
          return (
            <div
              key={s.id || i}
              onClick={() => onSelect(i)}
              style={{
                padding: '7px 12px', cursor: 'pointer',
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                background: isActive ? '#EEF2FF' : 'transparent',
                borderLeft: isActive ? '2.5px solid #4F6DC8' : '2.5px solid transparent',
                transition: 'background 80ms, border-color 80ms',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#F9FAFB' }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span style={{
                fontSize: '10px', fontWeight: 700,
                color: isActive ? '#4F6DC8' : '#D1D5DB',
                minWidth: '18px', flexShrink: 0, paddingTop: '1px',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {seq}
              </span>
              <span style={{
                fontSize: '11.5px', lineHeight: 1.45,
                color: isActive ? '#1E3A8A' : '#6B7280',
                fontWeight: isActive ? 600 : 400,
                overflow: 'hidden', textOverflow: 'ellipsis',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                {cleanTitle}
              </span>
            </div>
          )
        })}
      </div>
      {/* 快捷键提示 */}
      <div style={{
        padding: '6px 12px', borderTop: '1px solid #F3F4F6',
        fontSize: '9.5px', color: '#D1D5DB', textAlign: 'center',
        flexShrink: 0,
      }}>
        ↑↓ 快速切换
      </div>
    </div>
  )
}

// ── Main Modal ───────────────────────────────────────────────────
export default function ShotItemModal() {
  const { selectedShotItem, closeShotItemModal, openShotItemModal, nodes, updateShotItem } = useFlowStore()

  const poolNode = nodes.find(n => n.id === selectedShotItem?.poolNodeId)
  const shots: ShotItem[] = Array.isArray((poolNode?.data as any)?.shots) ? (poolNode?.data as any).shots : []
  const shot: ShotItem | undefined = selectedShotItem != null ? shots[selectedShotItem.shotIndex] : undefined

  const assetNodes = nodes
    .filter(n => ['character', 'appearance', 'scene', 'prop'].includes(n.type || ''))
    .map(n => {
      const d = n.data as Record<string, any>
      return { id: n.id, type: n.type || '', name: getAssetDisplayName(n.type, d) }
    })

  // Plain text state (for simple fields)
  const [title, setTitle] = useState('')

  // Rich field text values
  const cameraText = useRef('')
  const plotText = useRef('')
  const actionText = useRef('')
  const emotionText = useRef('')
  
  // Collected refs from manual drang-and-drop into image area
  const manualRefs = useRef<AssetRef[]>([])

  const [isGenerating, setIsGenerating] = useState(false)
  const [imgDragOver, setImgDragOver] = useState(false)
  const [previewPrompt, setPreviewPrompt] = useState('')
  const apiPromptRef = useRef<string>('')
  const initialized = useRef<string>('')
  const saveKey = useRef<string>('')

  // FakePanel ref to trigger insertChip from panel click
  const insertTrigger = useRef<((a: { id: string; type?: string; name: string }) => void) | null>(null)

  // ESC 关闭 + ↑↓ 切换分镜
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeShotItemModal()
      if (!selectedShotItem) return
      // 不在输入框内时才响应方向键
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.contentEditable === 'true') return
      if (e.key === 'ArrowUp' && selectedShotItem.shotIndex > 0) {
        e.preventDefault()
        openShotItemModal(selectedShotItem.poolNodeId, selectedShotItem.shotIndex - 1)
      }
      if (e.key === 'ArrowDown' && selectedShotItem.shotIndex < shots.length - 1) {
        e.preventDefault()
        openShotItemModal(selectedShotItem.poolNodeId, selectedShotItem.shotIndex + 1)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [closeShotItemModal, openShotItemModal, selectedShotItem, shots.length])

  // Sync on open
  useEffect(() => {
    if (!shot || !selectedShotItem) return
    const key = `${selectedShotItem.poolNodeId}-${selectedShotItem.shotIndex}`
    if (initialized.current === key) return
    initialized.current = key
    setTitle(shot.title || '')
    cameraText.current = shot.camera || ''
    plotText.current = shot.plot || ''
    actionText.current = shot.action || ''
    emotionText.current = shot.emotion || ''
    
    // Separate manual refs from text refs
    const extract = (txt: string) => {
      const found: string[] = []
      for (const a of assetNodes) {
        if (txt.includes(`@${a.name}`)) found.push(a.name)
      }
      return found
    }
    const textNames = new Set([
      ...extract(shot.title || ''), ...extract(shot.camera || ''), 
      ...extract(shot.plot || ''), ...extract(shot.action || ''), ...extract(shot.emotion || '')
    ])
    manualRefs.current = (shot.refs || []).filter(r => !textNames.has(r.name))

    // ★ 初始化时立刻把已有 prompt 显示出来，否则 previewPrompt 为空导致复制失效
    if (shot.prompt) {
      const cleaned = sanitizePromptText(shot.prompt.trim())
      setPreviewPrompt(cleaned)
      apiPromptRef.current = cleaned
    }
  }, [selectedShotItem?.poolNodeId, selectedShotItem?.shotIndex])

  const doSave = useCallback(() => {
    if (!selectedShotItem) return
    
    const extract = (txt: string) => {
      const names = assetNodes.filter(a => txt.includes(`@${a.name}`)).map(a => a.name)
      const arr: AssetRef[] = []
      names.forEach(name => {
        const a = assetNodes.find(n => n.name === name)
        if (a && !arr.find(x => x.nodeId === a.id)) arr.push({ nodeId: a.id, type: a.type, name: a.name })
      })
      return arr
    }
    
    const refsMap = new Map<string, AssetRef>()
    // Add extracted
    ;[
      ...extract(title), ...extract(cameraText.current),
      ...extract(plotText.current), ...extract(actionText.current), ...extract(emotionText.current),
      ...manualRefs.current
    ].forEach(r => refsMap.set(r.nodeId, r))

    const parts = [actionText.current, emotionText.current, cameraText.current].filter(Boolean)
    const fallbackBase = parts.join(' ').replace(/@/g, '') // 去除界面 @ 标记
    const promptBase = shot?.prompt || fallbackBase

    if (promptBase.trim()) {
      const finalPrompt = sanitizePromptText(promptBase.trim())
      apiPromptRef.current = finalPrompt
      setPreviewPrompt(finalPrompt)
    } else {
      apiPromptRef.current = ''
      setPreviewPrompt('')
    }

    updateShotItem(selectedShotItem.poolNodeId, selectedShotItem.shotIndex, {
      title, 
      camera: cameraText.current,
      plot: plotText.current,
      action: actionText.current,
      emotion: emotionText.current,
      refs: Array.from(refsMap.values()),
    } as any)
  }, [selectedShotItem, title, updateShotItem, assetNodes, shot?.prompt])

  useEffect(() => { doSave() }, [title])

  const copyPrompt = useCallback(() => {
    const text = previewPrompt || (shot?.prompt ? sanitizePromptText(shot.prompt.trim()) : '')
    if (!text) return
    navigator.clipboard.writeText(text)
      .then(() => toast.success('提示词已复制'))
      .catch(() => toast.error('复制失败'))
  }, [previewPrompt, shot?.prompt])

  if (!selectedShotItem || !shot) return null

  // 拖入图像区：仅录入 refs
  const handleImgDrop = (e: React.DragEvent) => {
    e.preventDefault(); setImgDragOver(false)
    try {
      const raw = e.dataTransfer.getData('application/json')
      const d = JSON.parse(raw)
      if (d?.nodeId && !manualRefs.current.find(r => r.nodeId === d.nodeId)) {
        manualRefs.current = [...manualRefs.current, { nodeId: d.nodeId, type: d.type, name: d.name }]
        doSave()
      }
    } catch {}
  }

  const handleGenerateImage = async () => {
    if (!selectedShotItem || isGenerating) return
    setIsGenerating(true)
    try {
      const prompt = apiPromptRef.current
      if (!prompt) throw new Error("请输入画面描述再生成图片。")
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 150000)
      
      const res = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: 'gpt-image-1-mini' }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      
      if (!res.ok) throw new Error(`Status: ${res.status}`)
      const data = await res.json()
      
      updateShotItem(selectedShotItem.poolNodeId, selectedShotItem.shotIndex, {
        imageUrl: data.imageUrl
      } as any)
    } catch (e) {
      console.error(e)
      alert('生成分镜图片失败，请稍后重试。')
    } finally {
      setIsGenerating(false)
    }
  }
  const handleDownloadImage = async () => {
    if (!shot.imageUrl) return;
    try {
      const res = await fetch(shot.imageUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `shot_${String(shot.num).padStart(2, '0')}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error('Failed to download image:', e);
      // fallback
      window.open(shot.imageUrl, '_blank');
    }
  };

  return (
    <div onPointerDown={e => { if (e.target === e.currentTarget) closeShotItemModal() }} style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'stretch',
        width: 'min(calc(100vw - 48px), 1580px)', maxHeight: '82vh',
      }}>

        {/* ── Left asset panel ── */}
        <AssetPanel assets={assetNodes}
          aiRefs={new Set((shot.refs || []).map((r: AssetRef) => r.nodeId))}
          onAdd={asset => {
            // panel click: focus last active MentionField and insert
            insertTrigger.current?.(asset)
          }} />

        {/* ── Modal card ── */}
        <div style={{
          background: '#FFFFFF', borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
          flex: 1, minWidth: 0, maxHeight: '82vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          fontFamily: 'var(--font-ui, system-ui, sans-serif)',
        }}>

          {/* Title bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 32px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0,
          }}>
            <div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '2px' }}>
                分镜 {String(shot.num).padStart(2, '0')}
              </div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' }}>
                {title || '（无标题）'}
              </h2>
            </div>
            <button onClick={closeShotItemModal} title="关闭 (ESC)" style={{
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

          {/* Body */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

            {/* Left: form */}
            <div style={{
              flex: '0 0 58%', padding: '24px 36px',
              overflowY: 'auto', display: 'flex', flexDirection: 'column',
              gap: '14px', borderRight: '1px solid #F3F4F6',
            }}>
              {/* ─ Live Prompt Preview ─ */}
              <div style={{
                background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', 
                padding: '16px', marginBottom: '8px', fontSize: '13px', color: '#4B5563', 
                lineHeight: 1.6, fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 600, color: '#111827', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    画面推演预览 (Live Prompt)
                  </div>
                  <span style={{ fontSize: '10px', color: '#64748B', background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px' }}>Nano Banana Native</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {previewPrompt || <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>请输入情节或行动描述以实时生成大模型推演提示词...</span>}
                </div>
              </div>

              <Field label="标题" value={title} onChange={v => { setTitle(v); doSave() }} />
              <MentionField key={`plot-${initialized.current}`}
                label="情节描述" initialValue={shot.plot || ''} assetNodes={assetNodes} rows={3}
                onChangeText={v => { plotText.current = v; doSave() }} insertTrigger={insertTrigger} />
              <MentionField key={`camera-${initialized.current}`}
                label="镜头规格" initialValue={shot.camera || ''} assetNodes={assetNodes} rows={2}
                onChangeText={v => { cameraText.current = v; doSave() }} insertTrigger={insertTrigger} />
              <MentionField key={`action-${initialized.current}`}
                label="行动描述" initialValue={shot.action || ''} assetNodes={assetNodes} rows={4}
                onChangeText={v => { actionText.current = v; doSave() }} insertTrigger={insertTrigger} />
              <MentionField key={`emotion-${initialized.current}`}
                label="情绪氛围" initialValue={shot.emotion || ''} assetNodes={assetNodes} rows={2}
                onChangeText={v => { emotionText.current = v; doSave() }} insertTrigger={insertTrigger} />
            </div>

            {/* Right: image */}
            <div style={{
              flex: 1, padding: '32px 28px 80px',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: '100%', aspectRatio: '1 / 1',
                borderRadius: '12px', background: '#F9FAFB',
                overflow: 'hidden', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                outline: imgDragOver ? '2px solid #6B83CC' : 'none',
                transition: 'outline 100ms',
              }}
                onDragOver={e => { e.preventDefault(); setImgDragOver(true) }}
                onDragLeave={() => setImgDragOver(false)}
                onDrop={handleImgDrop}
              >
                {shot.imageUrl
                  ? <img src={shot.imageUrl} alt="参考图像" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
                  : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="m21 15-5-5L5 21" />
                    </svg>
                    <p style={{ fontSize: '12px', color: '#D1D5DB', margin: 0, textAlign: 'center' }}>暂无参考图像</p>
                  </div>
                }
              </div>
            </div>
          </div>

          {/* Footer buttons */}
          <div style={{
            padding: '14px 28px 18px', borderTop: '1px solid #F3F4F6',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            gap: '10px', flexShrink: 0,
          }}>
            <ActionButton onClick={copyPrompt}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>}
              label="复制提示词" />
            <ActionButton
              onClick={handleGenerateImage}
              disabled={isGenerating}
              icon={isGenerating ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>}
              label={isGenerating ? '生成中...' : shot.imageUrl ? '重新生成' : '生成图片'} />
            <ActionButton primary
              disabled={!shot.imageUrl}
              onClick={handleDownloadImage}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7,10 12,15 17,10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>}
              label="下载原图" />
          </div>
        </div>

        {/* ── Right shot navigation panel ── */}
        <ShotNavPanel
          shots={shots}
          currentIndex={selectedShotItem.shotIndex}
          onSelect={(i) => {
            // 先重置 initialized 让表单能重新加载新分镜数据
            initialized.current = ''
            openShotItemModal(selectedShotItem.poolNodeId, i)
          }}
        />
      </div>
    </div>
  )
}
