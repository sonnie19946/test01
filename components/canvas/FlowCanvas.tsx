'use client'

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  OnSelectionChangeParams,
  SelectionMode,
  useReactFlow,
  Node,
  Edge,
  Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useFlowStore, FlowStoreContext, createFlowStore } from '@/hooks/useFlowStore'
import NodeContextMenu from '@/components/shared/NodeContextMenu'
import { AssetDetailModal } from '@/components/modals/AssetDetailModal'
import ShotItemModal from '@/components/modals/ShotItemModal'

import ScriptNode    from '@/components/nodes/ScriptNode'
import CharacterNode from '@/components/nodes/CharacterNode'
import AppearanceNode from '@/components/nodes/AppearanceNode'
import SceneNode     from '@/components/nodes/SceneNode'
import PropNode      from '@/components/nodes/PropNode'
import ShotNode      from '@/components/nodes/ShotNode'
import PromptNode    from '@/components/nodes/PromptNode'
import ShotPoolNode  from '@/components/nodes/ShotPoolNode'
import Sidebar       from '@/components/panels/Sidebar'
import { TYPE_LABELS, PALETTE, COLOR_HEX, VALID_TARGETS } from '@/constants/flow'

const nodeTypes = {
  script:    ScriptNode,
  character: CharacterNode,
  appearance: AppearanceNode,
  scene:     SceneNode,
  prop:      PropNode,
  shot:      ShotNode,
  prompt:    PromptNode,
  shot_pool: ShotPoolNode,
}





// ── Inner canvas ─────────────────────────────────────────────
function FlowCanvasInner() {
  const {
    nodes, edges, viewport,
    onNodesChange, onEdgesChange, onConnect,
    setViewport, setSelectedNodeId, deleteNode, addNode,
    fillNodeWithAI, refreshShotAssets,
    fitViewTrigger, setFitViewTrigger, autoLayout,
  } = useFlowStore()

  const router = useRouter()
  const { screenToFlowPosition, fitView, setCenter } = useReactFlow()

  // 监听 fitViewTrigger 变化，自动缩放视口以显示所有节点
  useEffect(() => {
    if (fitViewTrigger > 0) {
      fitView({ duration: 800 })
    }
  }, [fitViewTrigger, fitView])

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)
  const [paneMenu, setPaneMenu] = useState<{ x: number; y: number } | null>(null)

  // ── Selection ──
  const onSelectionChange = useCallback(
    ({ nodes: selected }: OnSelectionChangeParams) => {
      setSelectedNodeId(selected.length === 1 ? selected[0].id : null)
    },
    [setSelectedNodeId],
  )

  // ── 连线触发器 ──
  const handleConnect = useCallback(
    (connection: Connection) => {
      // 首先调用原始 onConnect 建立连线
      onConnect(connection)

      const { source, target, targetHandle } = connection
      if (!source || !target) return

      const sourceNode = nodes.find((n) => n.id === source)
      const targetNode = nodes.find((n) => n.id === target)
      if (!sourceNode || !targetNode) return

      // 多态分发：根据目标节点类型触发不同的 AI 行为
      // 只有 ScriptNode 作为源节点时才会触发 AI 提取
      if (sourceNode.type === 'script') {
        const targetType = targetNode.type
        const assetTypes = ['character', 'scene', 'prop'] as const

        // 如果目标是资产节点且为空，触发 AI 填充
        if (targetType && assetTypes.includes(targetType as any)) {
          const targetData = targetNode.data as Record<string, unknown> | undefined | null
          const isEmpty = !targetData || Object.keys(targetData).length === 0
          if (isEmpty) {
            fillNodeWithAI(source, target)
          }
        }
        // 未来扩展：其他目标类型可以在这里添加新的处理逻辑
        // 例如：if (targetType === 'shot') { ... }
      }
      // 资产连接到 shot 节点的 assets_all 手柄：静默刷新资产数据
      else if (targetNode.type === 'shot' && targetHandle === 'assets_all') {
        refreshShotAssets(target)
      }
    },
    [onConnect, nodes, fillNodeWithAI, refreshShotAssets]
  )

  // ── Delete key ──
  const onNodesDelete = useCallback(
    (deleted: Node[]) => { deleted.forEach((n) => deleteNode(n.id)) },
    [deleteNode],
  )

  // ── Connection validation ──
  const isValidConnection = useCallback(
    (edge: Edge | Connection) => {
      const { source, target, sourceHandle, targetHandle } = edge
      if (!source || !target || source === target) return false

      const sourceNode = nodes.find((n) => n.id === source)
      const targetNode = nodes.find((n) => n.id === target)
      if (!sourceNode || !targetNode) return false

      // 允许资产节点连接到 shot_pool 节点的 inputs 手柄
      if (targetNode.type === 'shot_pool' && targetHandle === 'inputs') {
        const assetTypes = ['appearance', 'scene', 'prop']
        return assetTypes.includes(sourceNode.type ?? '')
      }

      // 旧 shot 节点兼容
      if (targetNode.type === 'shot' && targetHandle === 'assets_all') {
        const assetTypes = ['appearance', 'scene', 'prop']
        return assetTypes.includes(sourceNode.type ?? '')
      }

      // 严格模式：ScriptNode 到资产节点的连接必须匹配 sourceHandle
      if (sourceNode.type === 'script' && ['character', 'scene', 'prop'].includes(targetNode.type ?? '')) {
        // Handle 到类型的精确映射
        const handleToType: Record<string, string> = {
          'extract_characters': 'character',
          'extract_scenes': 'scene',
          'extract_props': 'prop',
        }

        // 必须提供 sourceHandle 且必须匹配目标类型
        if (!sourceHandle) return false

        const expectedType = handleToType[sourceHandle]
        if (!expectedType) return false

        return targetNode.type === expectedType
      }

      // 其他连接使用 VALID_TARGETS 规则表
      const allowed = VALID_TARGETS[sourceNode.type ?? ''] ?? []
      return allowed.includes(targetNode.type ?? '')
    },
    [nodes],
  )

  // ── Context menu ──
  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent<Element> | MouseEvent, node: Node) => {
      e.preventDefault()
      setCtxMenu({ nodeId: node.id, x: e.clientX, y: e.clientY })
    },
    [],
  )

  // ── Pane context menu (for adding nodes) ──
  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent<Element> | MouseEvent) => {
      e.preventDefault()
      setPaneMenu({ x: e.clientX, y: e.clientY })
    },
    [],
  )

  // Close context menu when panning / clicking canvas
  const onPaneClick = useCallback(() => {
    setCtxMenu(null)
    setPaneMenu(null)
  }, [])

  // ── Manual add node ──
  const handleAddNode = useCallback(
    (type: string) => {
      const pos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      addNode(type, pos)
    },
    [screenToFlowPosition, addNode],
  )

  // ── Add node at specific screen position ──
  const handleAddNodeAtPosition = useCallback(
    (type: string, screenX: number, screenY: number) => {
      const pos = screenToFlowPosition({ x: screenX, y: screenY })
      addNode(type, pos)
      setPaneMenu(null)
    },
    [screenToFlowPosition, addNode],
  )

  // ── Group nodes by type for outline navigation ──
  const nodeGroups = nodes.reduce((acc, node) => {
    const type = node.type || 'unknown'
    if (!acc[type]) acc[type] = []
    acc[type].push(node)
    return acc
  }, {} as Record<string, typeof nodes>)


  // ── Focus on node ──
  const focusNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    // Center view on node position
    setCenter(node.position.x, node.position.y, { zoom: 1, duration: 800 })
  }, [nodes, setCenter])

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onSelectionChange={onSelectionChange}
        onNodesDelete={onNodesDelete}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        isValidConnection={isValidConnection}
        onMoveEnd={(_, vp) => setViewport(vp)}
        defaultViewport={viewport}
        minZoom={0.1}
        maxZoom={2.0}
        defaultEdgeOptions={{
          type: 'default',
          style: { stroke: '#C8D4F0', strokeWidth: 1.8 },
          animated: false,
        }}
        connectionLineStyle={{ stroke: '#84A1DF', strokeWidth: 2, strokeDasharray: '6 3' }}
        snapToGrid={true}
        snapGrid={[20, 20]}
        deleteKeyCode={['Backspace', 'Delete']}
        selectionOnDrag={true}
        selectionMode={SelectionMode.Partial}
        panOnDrag={false}
        panOnScroll={true}
        className="bg-[#FBFBF9] h-full w-full"
        colorMode="light"
      >
        <Background variant={BackgroundVariant.Dots} bgColor="transparent" color="#E4E4E7" gap={40} size={1} />
        <Controls showInteractive={false} />

        {/* ── 右下角操作区 ── */}
        <div style={{
          position: 'absolute', bottom: '16px', right: '16px', zIndex: 10,
          display: 'flex', gap: '8px', alignItems: 'center',
        }}>
          {/* 回到画板 */}
          <button
            onClick={() => router.push('/')}
            title="回到画板列表"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '10px',
              background: '#FFFFFF',
              border: '1.5px solid #E4E4E7',
              color: '#27272A', fontSize: '12.5px', fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              transition: 'all 150ms',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = '#84A1DF'
              el.style.color = '#84A1DF'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = '#E4E4E7'
              el.style.color = '#27272A'
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            画板列表
          </button>

          {/* 自动布局 */}
          <button
            onClick={autoLayout}
            title="自动整理布局"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '10px',
              background: '#1F2937', border: 'none',
              color: '#FFFFFF', fontSize: '12.5px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
              transition: 'opacity 150ms',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
            自动布局
          </button>
        </div>

      </ReactFlow>

      {/* ── 右键菜单 ── */}
      {ctxMenu && (
        <NodeContextMenu
          nodeId={ctxMenu.nodeId}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* ── 画布右键菜单（添加节点） ── */}
      {paneMenu && (() => {
        const ITEMS: ({ type: string; label: string; desc: string } | null)[] = [
          { type: 'script',    label: '剧本',   desc: '主线故事，提取全部素材' },
          { type: 'character', label: '角色',   desc: '人物设定、外貌与性格' },
          { type: 'scene',     label: '场景',   desc: '地点、时间与环境氛围' },
          { type: 'prop',      label: '道具',   desc: '关键物品与器械' },
          { type: 'appearance', label: '角色形象', desc: '角色四视图造型设计' },
          null,
          { type: 'shot',      label: '分镜',   desc: '镜头构成与运动方式' },
        ]

        // 边界保护：防止菜单超出视口
        const W = typeof window !== 'undefined' ? window.innerWidth  : 1440
        const H = typeof window !== 'undefined' ? window.innerHeight : 900
        const safeX = Math.min(paneMenu.x, W - 234)
        const safeY = Math.min(paneMenu.y, H - 420)

        return (
          <div
            style={{
              position: 'fixed', left: safeX, top: safeY,
              zIndex: 1000,
              background: '#FFFFFF',
              border: '1px solid rgba(0,0,0,0.07)',
              borderRadius: '14px',
              boxShadow: '0 16px 48px -8px rgba(0,0,0,0.13), 0 4px 16px rgba(0,0,0,0.07)',
              width: '224px',
              padding: '6px',
              fontFamily: 'var(--font-ui, system-ui, sans-serif)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 标题 */}
            <div style={{
              padding: '7px 14px 9px',
              fontSize: '10.5px', fontWeight: 600,
              color: '#BCBCBC', letterSpacing: '0.08em',
              userSelect: 'none',
            }}>
              添加节点
            </div>

            {ITEMS.map((item, i) =>
              item === null ? (
                <div key={`sep-${i}`} style={{ height: '1px', background: '#F3F4F6', margin: '4px 8px' }} />
              ) : (
                <div
                  key={item.type}
                  onClick={() => handleAddNodeAtPosition(item.type, paneMenu.x, paneMenu.y)}
                  style={{
                    display: 'flex', alignItems: 'center',
                    padding: '8px 13px', borderRadius: '9px',
                    cursor: 'pointer', gap: '11px',
                    transition: 'background 100ms',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F5F5F3' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {/* 类型色点 */}
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                    background: COLOR_HEX[item.type] || '#888',
                    marginTop: '1px',
                  }} />
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 500, color: '#111827', lineHeight: 1.3 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '11px', color: '#AEAEAE', marginTop: '1px', lineHeight: 1.2 }}>
                      {item.desc}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )
      })()}


      {/* ── 左侧边栏 ── */}
      <Sidebar nodeGroups={nodeGroups} typeLabels={TYPE_LABELS} focusNode={focusNode} />
    </>
  )
}

// ── Exported component ───────────────────────────────────────
export default function FlowCanvas({ boardId }: { boardId?: string }) {
  const resolvedBoardId = boardId ?? 'demo'
  const store = createFlowStore(resolvedBoardId)

  return (
    <FlowStoreContext.Provider value={store}>
      <div style={{ width: '100vw', height: '100vh', position: 'relative', backgroundColor: '#FBFBF9' }}>
        <ReactFlowProvider>
          <FlowCanvasInner />
        </ReactFlowProvider>
        <AssetDetailModal />
        <ShotItemModal />
      </div>
    </FlowStoreContext.Provider>
  )
}
