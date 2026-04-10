import { create, StoreApi, UseBoundStore } from 'zustand'
import { persist } from 'zustand/middleware'
import { createContext, useContext } from 'react'
import { toast } from 'sonner'
import {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
  Viewport,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react'
import { applyDagreLayout } from '@/hooks/useLayoutEngine'
import { generateReferenceImage as _generateReferenceImage, generateShotImage as _generateShotImage } from '@/actions/imageActions'
import { extractAssets as _extractAssets, extractByType as _extractByType, fillNodeWithAI as _fillNodeWithAI } from '@/actions/extractActions'
import { generateShotPool as _generateShotPool, refreshShotAssets as _refreshShotAssets } from '@/actions/shotActions'

// ============================================================
// 项目元数据
// ============================================================
interface ProjectState {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

// ============================================================
// Store 完整类型
// ============================================================
interface FlowStore {
  // --- 状态 ---
  project: ProjectState
  nodes: Node[]
  edges: Edge[]
  viewport: Viewport

  // --- 选中节点（不持久化）---
  selectedNodeId: string | null
  setSelectedNodeId: (id: string | null) => void

  // --- 选中资产节点（弹窗）---
  selectedAssetNode: Node | null
  openAssetModal: (nodeId: string) => void
  closeAssetModal: () => void

  // --- 分镜池分项展开 ---
  selectedShotItem: { poolNodeId: string; shotIndex: number } | null
  openShotItemModal: (poolNodeId: string, shotIndex: number) => void
  closeShotItemModal: () => void
  updateShotItem: (poolNodeId: string, shotIndex: number, data: Record<string, unknown>) => void

  // --- 视口适配触发器 ---
  fitViewTrigger: number
  setFitViewTrigger: (trigger: number) => void

  // --- React Flow 标准变更处理器 ---
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void

  // --- 视口 ---
  setViewport: (viewport: Viewport) => void

  // --- 直接设置 ---
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void

  // --- 单节点数据更新 ---
  updateNodeData: (id: string, data: Record<string, unknown>) => void

  // --- 单节点删除（同时移除关联边）---
  deleteNode: (id: string) => void

  // --- 手动新建空白节点 ---
  addNode: (type: string, position: { x: number; y: number }) => void

  // --- AI 提取资产（Phase 3）---
  extractAssets: (scriptNodeId: string, scriptText: string) => Promise<void>

  // --- 单类型精准提取 ---
  extractByType: (
    scriptNodeId: string,
    scriptText: string,
    assetType: 'character' | 'appearance' | 'prop' | 'scene' | 'shot'
  ) => Promise<void>

  // --- 连线时 AI 填充单个节点 ---
  fillNodeWithAI: (scriptNodeId: string, targetNodeId: string) => Promise<void>

  // --- 分镜池 AI 生成（新）---
  generateShotPool: (poolNodeId: string) => Promise<void>



  // --- 分镜资产数据静默刷新（连线时触发）---
  refreshShotAssets: (shotNodeId: string) => void

  // --- 资产参考图生成（Phase 4）---
  generateReferenceImage: (nodeId: string, assetType: string, textData: any) => Promise<void>

  // --- 分镜图像生成（Phase 4）---
  generateShotImage: (imageNodeId: string, prompt: string) => Promise<void>

  // --- 项目元数据 ---
  updateProject: (updates: Partial<Pick<ProjectState, 'name'>>) => void

  // --- 一键自动布局 ---
  autoLayout: () => void
}

// ============================================================
// 初始节点
// ============================================================
const initialNodes: Node[] = [
  {
    id: 'script-1',
    type: 'script',
    position: { x: 200, y: 100 },
    data: { text: '' },
  },
]

// ============================================================
// 工厂函数：根据 boardId 创建独立的持久化 store
// ============================================================
const storeCache = new Map<string, UseBoundStore<StoreApi<FlowStore>>>()

export function createFlowStore(boardId: string): UseBoundStore<StoreApi<FlowStore>> {
  if (storeCache.has(boardId)) return storeCache.get(boardId)!

  const store = create<FlowStore>()(
  persist(
    (set, get) => ({
      // ----- 初始状态 -----
      project: {
        id: 'demo',
        name: '未命名项目',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      nodes: initialNodes,
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      selectedNodeId: null,
      selectedAssetNode: null,
      selectedShotItem: null,
      fitViewTrigger: 0,

      // ----- 选中节点 -----
      setSelectedNodeId: (id) => set({ selectedNodeId: id }),

      // ----- 资产节点弹窗 -----
      openAssetModal: (nodeId) => {
        const node = get().nodes.find((n) => n.id === nodeId);
        if (node) {
          set({ selectedAssetNode: node });
        }
      },
      closeAssetModal: () => set({ selectedAssetNode: null }),

      // ----- 分镜池分项 modal -----
      openShotItemModal: (poolNodeId, shotIndex) => set({ selectedShotItem: { poolNodeId, shotIndex } }),
      closeShotItemModal: () => set({ selectedShotItem: null }),
      updateShotItem: (poolNodeId, shotIndex, data) =>
        set(state => ({
          nodes: state.nodes.map(n => {
            if (n.id !== poolNodeId) return n
            const shots = Array.isArray((n.data as any).shots) ? [...(n.data as any).shots] : []
            shots[shotIndex] = { ...shots[shotIndex], ...data }
            return { ...n, data: { ...n.data, shots } }
          }),
        })),

      // ----- 视口适配触发器 -----
      setFitViewTrigger: (trigger) => set({ fitViewTrigger: trigger }),

      // ----- React Flow 标准变更处理器 -----
      onNodesChange: (changes) =>
        set({ nodes: applyNodeChanges(changes, get().nodes) }),

      onEdgesChange: (changes) =>
        set({ edges: applyEdgeChanges(changes, get().edges) }),

      onConnect: (connection) =>
        set({ edges: addEdge(connection, get().edges) }),

      // ----- 视口持久化 -----
      setViewport: (viewport) => set({ viewport }),

      // ----- 批量设置（Phase 3+ AI 提取时使用）-----
      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),

      // ----- 单节点数据更新 -----
      updateNodeData: (id, data) =>
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
          ),
        })),

      // ----- 单节点删除 -----
      deleteNode: (id) =>
        set((state) => ({
          nodes: state.nodes.filter((n) => n.id !== id),
          edges: state.edges.filter((e) => e.source !== id && e.target !== id),
          selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
        })),

      // ----- 手动新建空白节点 -----
      addNode: (type, position) => {
        const id = `${type}-${crypto.randomUUID()}`
        set((state) => ({
          nodes: [...state.nodes, { id, type, position, data: {} }],
        }))
      },

      // ----- AI 提取资产（委托 extractActions）-----
      extractAssets: async (scriptNodeId, scriptText) => {
        await _extractAssets(get, set, scriptNodeId, scriptText)
      },

      // ----- 单类型精准提取（委托 extractActions）-----
      extractByType: async (scriptNodeId, scriptText, assetType) => {
        await _extractByType(get, set, scriptNodeId, scriptText, assetType)
      },

      // ----- 连线时 AI 填充单个节点（委托 extractActions）-----
      fillNodeWithAI: async (scriptNodeId, targetNodeId) => {
        await _fillNodeWithAI(get, scriptNodeId, targetNodeId)
      },


      // ----- 分镜池 AI 生成（委托 shotActions）-----
      generateShotPool: async (poolNodeId) => {
        await _generateShotPool(get, set, poolNodeId)
      },

      // ----- 分镜资产数据静默刷新（委托 shotActions）-----
      refreshShotAssets: (shotNodeId) => {
        _refreshShotAssets(get, shotNodeId)
      },

      // ----- 资产参考图生成（委托 imageActions）-----
      generateReferenceImage: async (nodeId, assetType, textData) => {
        await _generateReferenceImage(get, nodeId, assetType, textData)
      },

      // ----- 分镜图像生成（委托 imageActions）-----
      generateShotImage: async (imageNodeId, prompt) => {
        await _generateShotImage(get, imageNodeId, prompt)
      },

      // ----- 项目元数据更新 -----
      updateProject: (updates) =>
        set((state) => ({
          project: {
            ...state.project,
            ...updates,
            updatedAt: Date.now(),
          },
        })),

      autoLayout: () => {
        const { nodes, edges } = get()
        if (nodes.length === 0) return
        const laid = applyDagreLayout(nodes, edges, { rankSep: 140, nodeSep: 20 })
        set({ nodes: laid })
        // 给 React Flow 一帧时间 re-render 新坐标，再 fitView
        setTimeout(() => get().setFitViewTrigger(Date.now()), 60)
      },
    }),
    {
      name: `sonnie-flow-${boardId}`,
      version: 2,
      // selectedNodeId 不持久化；过滤掉 base64 图片数据防止撑爆 localStorage
      partialize: (state) => ({
        project: state.project,
        nodes: state.nodes.map(n => {
          const d = { ...n.data } as Record<string, any>
          // 去掉 data:image 开头的大体积字段
          if (typeof d.referenceImage === 'string' && d.referenceImage.startsWith('data:')) delete d.referenceImage
          if (typeof d.imageUrl === 'string' && d.imageUrl.startsWith('data:')) delete d.imageUrl
          // 清除瞬态 loading 状态，防止重启后卡住
          delete d.isGeneratingRef
          delete d.loading
          if (d.status === 'generating') d.status = 'idle'
          // 分镜池内的 shots 也清理
          if (Array.isArray(d.shots)) {
            d.shots = d.shots.map((s: any) => {
              if (typeof s.imageUrl === 'string' && s.imageUrl.startsWith('data:')) {
                const { imageUrl: _, ...rest } = s
                return rest
              }
              return s
            })
          }
          return { ...n, data: d }
        }),
        edges: state.edges,
        viewport: state.viewport,
      }),
      // costume → appearance 迁移
      migrate: (persistedState: any, version: number) => {
        if (version < 2 && persistedState?.nodes) {
          persistedState.nodes = persistedState.nodes.map((n: any) => {
            if (n.type !== 'costume') return n
            const d = n.data || {}
            return {
              ...n,
              type: 'appearance',
              data: {
                characterName: d.versionName || d.name || '',
                style: d.description || '',
                bodyType: '',
                clothing: [d.top, d.bottom, d.outerwear].filter(Boolean).join('；'),
                colorScheme: '',
                distinctiveFeatures: '',
                frontView: '',
                backView: '',
                sideDetail: '',
                description: d.plotBasis || '',
              },
            }
          })
        }
        return persistedState
      },
    },
  ),
)

  storeCache.set(boardId, store)
  return store
}

// ============================================================
// React Context：透明地将 store 实例注入组件树
// ============================================================
export const FlowStoreContext = createContext<UseBoundStore<StoreApi<FlowStore>> | null>(null)

/** 在 FlowStoreProvider 内部使用，等价于原来的 useFlowStore() */
export function useFlowStore(): FlowStore
export function useFlowStore<T>(selector: (state: FlowStore) => T): T
export function useFlowStore<T>(selector?: (state: FlowStore) => T): FlowStore | T {
  const store = useContext(FlowStoreContext)
  if (!store) throw new Error('useFlowStore must be used within FlowStoreProvider')
  // @ts-ignore – zustand overload
  return selector ? store(selector) : store()
}
