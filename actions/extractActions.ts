/**
 * extractActions.ts
 *
 * 从 useFlowStore 中剥离的 AI 资产提取业务逻辑。
 * - extractAssets: 全量提取（角色/场景/道具/形象 + 分镜池）
 * - extractByType: 单类型精准提取
 * - fillNodeWithAI: 连线时 AI 填充单个节点
 *
 * 复用 lib/nodeDataMappers.ts 进行数据映射。
 * 通过接收 get/set 实现对 store 状态的读写。
 */

import { Node, Edge } from '@xyflow/react'
import { toast } from 'sonner'
import { getScriptHeaders, requireScriptConfig, ByokConfigError } from '@/lib/byokHeaders'
import {
  mapCharacterData,
  mapSceneData,
  mapPropData,
  mapAppearanceData,
  mapNodeData,
  getMatchKey,
} from '@/lib/nodeDataMappers'

// ── Store 访问器类型 ────────────────────────────────────────

type StoreGet = () => {
  nodes: Node[]
  edges: Edge[]
  updateNodeData: (nodeId: string, data: Record<string, any>) => void
  addNode: (type: string, position: { x: number; y: number }) => void
  autoLayout: () => void
  generateShotPool: (poolNodeId: string) => Promise<void>
  setFitViewTrigger: (trigger: number) => void
}
type StoreSet = (fn: (state: { nodes: Node[]; edges: Edge[] }) => Partial<{ nodes: Node[]; edges: Edge[] }>) => void

// ── extractAssets ───────────────────────────────────────────

export async function extractAssets(
  get: StoreGet,
  set: StoreSet,
  scriptNodeId: string,
  scriptText: string,
): Promise<void> {
  const scriptNode = get().nodes.find((n) => n.id === scriptNodeId)
  if (!scriptNode) return

  // 设置 loading 状态
  get().updateNodeData(scriptNodeId, { loading: true })

  let timeoutId: NodeJS.Timeout | null = null
  try {
    requireScriptConfig()
    toast.info('开始提取资产...')
    const controller = new AbortController()
    timeoutId = setTimeout(() => controller.abort(new Error('extract timeout')), 180000) // 180秒超时

    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getScriptHeaders() },
      body: JSON.stringify({ scriptText }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    timeoutId = null

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      const detail = errBody?.error || errBody?.detail || `${res.status} ${res.statusText}`
      throw new Error(`资产提取失败: ${detail}`)
    }

    const { eraSetting = '', characters = [], scenes = [], props = [], appearances = [] } = await res.json()

    // 空数据检查
    if (characters.length === 0 && scenes.length === 0 && props.length === 0 && appearances.length === 0) {
      toast.error('未识别到有效资产')
      return
    }

    // 递归收集剧本节点的所有后代节点（BFS）
    // 确保角色→服装→分镜池等多层节点都被清除
    const { edges: currEdges } = get()
    const oldDescendantIds = new Set<string>()
    const bfsQueue: string[] = [scriptNodeId]
    while (bfsQueue.length > 0) {
      const parentId = bfsQueue.shift()!
      const childEdges = currEdges.filter(e => e.source === parentId)
      for (const edge of childEdges) {
        if (!oldDescendantIds.has(edge.target)) {
          oldDescendantIds.add(edge.target)
          bfsQueue.push(edge.target)
        }
      }
    }
    // 兼容旧变量名
    const oldTargetIds = oldDescendantIds

    const newNodes: Node[] = []
    const newEdges: Edge[] = []

    // 十字发散坐标系：以剧本节点为中心向四个方向发散
    const baseX = scriptNode.position.x;
    const baseY = scriptNode.position.y;
    const SPACING = 320; // 同类多个节点时的间距

    // 独立定义四个方向的偏移距离
    const OFFSET_UP = 350;    // 角色（上）
    const OFFSET_DOWN = 500;  // 场景（下）
    const OFFSET_LEFT = 650;  // 道具（左）
    const OFFSET_RIGHT = 650; // 角色形象（右）

    // 强制弹窗反馈：开始部署资产到画布
    toast.success('正在将提取到的资产布署到画布...')

    // 处理人物节点
    if (characters.length === 0) {
      toast.error('API 返回的人物数据为空，无法生成角色节点')
    }
    for (let i = 0; i < characters.length; i++) {
      const c = characters[i]
      const nodeId = `character-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`

      const characterData = mapCharacterData(c, eraSetting)

      newNodes.push({
        id: nodeId,
        type: 'character',
        position: { x: baseX + (i * SPACING), y: baseY - OFFSET_UP },
        data: characterData,
        zIndex: 1000,
      })
      newEdges.push({
        id: `e-${scriptNodeId}-${nodeId}`,
        source: scriptNodeId,
        target: nodeId,
        sourceHandle: 'extract_characters',
      })
    }

    // 处理场景节点
    if (scenes.length === 0) {
      toast.error('API 返回的场景数据为空，无法生成场景节点')
    }
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i]
      const nodeId = `scene-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`

      const sceneData = mapSceneData(s, eraSetting)

      newNodes.push({
        id: nodeId,
        type: 'scene',
        position: { x: baseX + (i * SPACING), y: baseY + OFFSET_DOWN },
        data: sceneData,
        zIndex: 1000,
      })
      newEdges.push({
        id: `e-${scriptNodeId}-${nodeId}`,
        source: scriptNodeId,
        target: nodeId,
        sourceHandle: 'extract_scenes',
      })
    }

    // 处理道具节点
    if (props.length === 0) {
      toast.error('API 返回的道具数据为空，无法生成道具节点')
    }
    for (let i = 0; i < props.length; i++) {
      const p = props[i]
      const nodeId = `prop-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`

      const propData = mapPropData(p, eraSetting)

      newNodes.push({
        id: nodeId,
        type: 'prop',
        position: { x: baseX - OFFSET_LEFT, y: baseY + (i * SPACING) - 100 },
        data: propData,
        zIndex: 1000,
      })
      newEdges.push({
        id: `e-${scriptNodeId}-${nodeId}`,
        source: scriptNodeId,
        target: nodeId,
        sourceHandle: 'extract_props',
      })
    }

    // 处理角色形象节点
    if (appearances.length === 0) {
      toast.error('API 返回的角色形象数据为空，无法生成角色形象节点')
    }
    // 提前获取已创建的角色节点，用于建立 character→appearance 连线
    const newCharacterNodes = newNodes.filter(n => n.type === 'character')

    for (let i = 0; i < appearances.length; i++) {
      const c = appearances[i]
      const nodeId = `appearance-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`

      const appearanceData = mapAppearanceData(c, eraSetting)

      newNodes.push({
        id: nodeId,
        type: 'appearance',
        position: { x: baseX + OFFSET_RIGHT, y: baseY + (i * SPACING) - 100 },
        data: appearanceData,
        zIndex: 1000,
      })

      // 角色形象按 characterName 匹配对应角色节点（优先精确，次选最长子串）
      const appCharName = c.characterName || ''
      let matchedChar = newCharacterNodes.find(n => (n.data as any)?.name === appCharName)
      if (!matchedChar) {
        // 模糊匹配时选最长匹配名，防止"公爵"抢走"公爵夫人"
        let bestLen = 0
        for (const n of newCharacterNodes) {
          const charName = (n.data as any)?.name || ''
          if (appCharName.includes(charName) || charName.includes(appCharName)) {
            const matchLen = Math.min(charName.length, appCharName.length)
            if (matchLen > bestLen) { bestLen = matchLen; matchedChar = n }
          }
        }
      }
      if (matchedChar) {
        newEdges.push({
          id: `e-${matchedChar.id}-${nodeId}`,
          source: matchedChar.id,
          target: nodeId,
        })
      } else {
        // 没匹配到则挂到剧本节点
        newEdges.push({
          id: `e-${scriptNodeId}-${nodeId}`,
          source: scriptNodeId,
          target: nodeId,
        })
      }
    }

    console.log('[extractAssets] New nodes to add:', newNodes.map(n => ({ id: n.id, type: n.type, position: n.position })))

    // 1. 生成分镜池节点 (放置在最右侧)
    const poolNodeId = `shot_pool-${Date.now()}`;
    newNodes.push({
      id: poolNodeId,
      type: 'shot_pool',
      position: { x: baseX + OFFSET_RIGHT + 550, y: baseY },
      data: { shots: [], loading: true, eraSetting },
      zIndex: 1000,
    });

    // 2. 建立资产到分镜池的连线（角色不直连分镜，通过服装间接关联）
    newNodes.forEach(node => {
      if (node.id === poolNodeId) return;
      if (node.type === 'character') return;
      const allowed = ['scene', 'appearance', 'prop']
      if (allowed.includes(node.type || '')) {
        newEdges.push({
          id: `e-${node.id}-${poolNodeId}`,
          source: node.id,
          target: poolNodeId,
          targetHandle: 'inputs',
        });
      }
    });

    set((state) => ({
      nodes: [
        // 保留剩余节点，同时把 eraSetting 写回剧本节点 data
        ...state.nodes
          .filter((n) => !oldTargetIds.has(n.id))
          .map((n) => n.id === scriptNodeId
            ? { ...n, data: { ...n.data, eraSetting } }
            : n
          ),
        ...newNodes,
      ],
      edges: [
        // 删除：source 或 target 是任何被删节点（包括多层后代）
        ...state.edges.filter(
          (e) => e.source !== scriptNodeId
            && !oldTargetIds.has(e.source)
            && !oldTargetIds.has(e.target)
        ),
        ...newEdges,
      ],
    }))

    // 用 Dagre 重新布局，自动 fitView
    get().autoLayout()

    // 自动触发分镜池生成
    try {
      await get().generateShotPool(poolNodeId)
    } catch (shotError) {
      console.error('[extractAssets] 分镜池自动生成失败:', shotError)
      toast.error('资产提取成功，但分镜自动生成失败')
    }

    console.log('[extractAssets] Current canvas nodes:', get().nodes.map(n => ({ id: n.id, type: n.type, position: n.position })))
  } catch (error) {
    console.error('AI 提取失败:', error)
    if (error instanceof ByokConfigError) {
      toast.error(error.message)
    } else if (error instanceof Error && error.name === 'AbortError') {
      toast.error('提取请求超时，请检查网络或 API 状态')
    } else {
      toast.error('剧本提取失败，请检查网络或剧本格式')
    }
  } finally {
    // 清除超时定时器
    if (timeoutId) clearTimeout(timeoutId)
    // 清除 loading 状态
    get().updateNodeData(scriptNodeId, { loading: false })
  }
}

// ── extractByType ───────────────────────────────────────────

export async function extractByType(
  get: StoreGet,
  set: StoreSet,
  scriptNodeId: string,
  scriptText: string,
  assetType: string,
): Promise<void> {
  const scriptNode = get().nodes.find(n => n.id === scriptNodeId)
  if (!scriptNode) return

  // 提取分镜：找或创建 shot_pool，然后触发 generateShotPool
  if (assetType === 'shot') {
    let poolNode = get().nodes.find(n => n.type === 'shot_pool')
    if (!poolNode) {
      const pos = { x: scriptNode.position.x + 400, y: scriptNode.position.y + 400 }
      get().addNode('shot_pool', pos)
      await new Promise(r => setTimeout(r, 60))
      poolNode = get().nodes.filter(n => n.type === 'shot_pool').at(-1)
    }
    if (poolNode) {
      await get().generateShotPool(poolNode.id)
      get().setFitViewTrigger(Date.now())
    }
    return
  }

  // 其他资产类型
  get().updateNodeData(scriptNodeId, { loading: true })
  try {
    requireScriptConfig()
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 90000)

    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getScriptHeaders() },
      body: JSON.stringify({ scriptText }),
      signal: controller.signal,
    })
    clearTimeout(tid)

    if (!res.ok) throw new Error(`API 错误: ${res.status}`)
    const data = await res.json()
    const eraSetting: string = data.eraSetting || ''

    // 取对应数组
    const keyMap: Record<string, string> = {
      character: 'characters', appearance: 'appearances',
      scene: 'scenes', prop: 'props',
    }
    const items: any[] = data[keyMap[assetType]] || []
    if (items.length === 0) {
      toast.error('未提取到相关内容')
      return
    }

    const SPACING = 180
    const baseX = scriptNode.position.x
    const baseY = scriptNode.position.y
    const offsetX: Record<string, number> = {
      character: -350, scene: 350, prop: -650, appearance: 650,
    }

    const newNodes: any[] = []
    const newEdges: any[] = []
    let updatedCount = 0

    // 防止重复创建的现有节点查找基准
    const currentNodes = get().nodes

    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      let nodeData: Record<string, any> = {}
      let matchKey = ''

      // 完整数据映射（统一走 nodeDataMappers）
      if (assetType === 'character') {
        nodeData = mapCharacterData(it, eraSetting)
        matchKey = nodeData.name
      } else if (assetType === 'prop') {
        nodeData = mapPropData(it, eraSetting)
        matchKey = nodeData.name
      } else if (assetType === 'scene') {
        nodeData = mapSceneData(it, eraSetting)
        matchKey = nodeData.name
      } else if (assetType === 'appearance') {
        nodeData = mapAppearanceData(it, eraSetting)
        matchKey = getMatchKey(assetType, nodeData, it)
      } else {
        nodeData = mapNodeData(assetType, it, eraSetting)
        matchKey = nodeData.name
      }

      // 查找是否存在同类且同名的旧节点
      const existingNode = currentNodes.find(n => {
        if (n.type !== assetType) return false
        if (assetType === 'appearance') {
          return `${(n.data as any).characterName}-${(n.data as any).versionName || ''}` === matchKey
        }
        return (n.data as any).name === matchKey
      })

      if (existingNode) {
        // 找到旧节点，更新数据而不是新建
        get().updateNodeData(existingNode.id, nodeData)
        updatedCount++
      } else {
        // 新建节点
        const nodeId = `${assetType}-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`
        newNodes.push({
          id: nodeId, type: assetType,
          position: { x: baseX + (offsetX[assetType] || 400), y: baseY + i * SPACING - 100 },
          data: nodeData, zIndex: 1000,
        })
        newEdges.push({
          id: `e-${scriptNodeId}-${nodeId}`,
          source: scriptNodeId, target: nodeId,
        })
      }
    }

    if (newNodes.length > 0) {
      set(s => ({
        nodes: [
          ...s.nodes.map(n => n.id === scriptNodeId
            ? { ...n, data: { ...n.data, eraSetting } }
            : n
          ),
          ...newNodes,
        ],
        edges: [...s.edges, ...newEdges],
      }))
      get().setFitViewTrigger(Date.now())
    } else if (eraSetting) {
      // 没有新建节点但有 eraSetting，仍然写回剧本节点
      get().updateNodeData(scriptNodeId, { eraSetting })
    }

    const labelMap: Record<string, string> = {
      character: '角色', appearance: '角色形象', scene: '场景', prop: '道具',
    }
    if (newNodes.length > 0 && updatedCount > 0) {
      toast.success(`已提取并新增 ${newNodes.length} 个${labelMap[assetType]}，同时更新了 ${updatedCount} 个旧节点`)
    } else if (updatedCount > 0) {
      toast.success(`已更新 ${updatedCount} 个现有${labelMap[assetType]}节点信息`)
    } else {
      toast.success(`已新增 ${newNodes.length} 个${labelMap[assetType]}节点`)
    }
  } catch (e) {
    if (e instanceof ByokConfigError) {
      toast.error(e.message)
    } else if (e instanceof Error && e.name === 'AbortError') {
      toast.error('请求超时')
    } else {
      toast.error('提取失败，请重试')
    }
  } finally {
    get().updateNodeData(scriptNodeId, { loading: false })
  }
}

// ── fillNodeWithAI ──────────────────────────────────────────

export async function fillNodeWithAI(
  get: StoreGet,
  scriptNodeId: string,
  targetNodeId: string,
): Promise<void> {
  const scriptNode = get().nodes.find((n) => n.id === scriptNodeId)
  const targetNode = get().nodes.find((n) => n.id === targetNodeId)
  if (!scriptNode || !targetNode) return

  const scriptText = (scriptNode.data as { text?: string }).text?.trim()
  if (!scriptText) return

  // 设置 loading 状态
  get().updateNodeData(scriptNodeId, { loading: true })
  get().updateNodeData(targetNodeId, { loading: true })

  let timeoutId: NodeJS.Timeout | null = null
  try {
    requireScriptConfig()
    const controller = new AbortController()
    timeoutId = setTimeout(() => controller.abort(), 30000) // 30秒超时

    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getScriptHeaders() },
      body: JSON.stringify({ scriptText }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    timeoutId = null

    if (!res.ok) {
      throw new Error(`API 错误: ${res.status} ${res.statusText}`)
    }

    const apiResult = await res.json()
    const { characters = [], scenes = [], props = [], appearances = [] } = apiResult
    const eraSetting: string = apiResult.eraSetting || ''

    // 根据目标节点类型选择对应的数据（统一走 nodeDataMappers）
    let newData: Record<string, unknown> = {}
    const typeArrayMap: Record<string, any[]> = {
      character: characters, scene: scenes, prop: props, appearance: appearances,
    }
    const typeLabelMap: Record<string, string> = {
      character: '角色', scene: '场景', prop: '道具', appearance: '角色形象',
    }
    const items = typeArrayMap[targetNode.type || '']
    if (items && items.length > 0) {
      newData = mapNodeData(targetNode.type || '', items[0], eraSetting)
    } else if (items) {
      toast.info(`未提取到${typeLabelMap[targetNode.type || ''] || ''}信息，请检查剧本内容`)
    }

    // 更新目标节点数据
    if (Object.keys(newData).length > 0) {
      get().updateNodeData(targetNodeId, newData)
    }
  } catch (error) {
    console.error('AI 填充节点失败:', error)
    if (error instanceof ByokConfigError) {
      toast.error(error.message)
    } else if (error instanceof Error && error.name === 'AbortError') {
      toast.error('提取请求超时，请检查网络或 API 状态')
    } else {
      toast.error('AI 填充失败，请稍后重试')
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
    get().updateNodeData(scriptNodeId, { loading: false })
    get().updateNodeData(targetNodeId, { loading: false })
  }
}

// ── extractHighlight ────────────────────────────────────────

/**
 * 局部框选提取：右键菜单触发，将选中文本发给 /api/extract-highlight，
 * 结果以独立节点形式放在剧本卡片的左侧，不干扰现有节点。
 */
export async function extractHighlight(
  get: StoreGet,
  set: StoreSet,
  scriptNodeId: string,
  selectedText: string,
  extractionType: 'prop' | 'scene' | 'character_appearance',
): Promise<void> {
  const scriptNode = get().nodes.find((n) => n.id === scriptNodeId)
  if (!scriptNode) return

  const fullScriptText: string = (scriptNode.data as any)?.text || ''

  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), 90000)

  try {
    requireScriptConfig()

    const res = await fetch('/api/extract-highlight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getScriptHeaders() },
      body: JSON.stringify({
        selected_text: selectedText,
        full_script: fullScriptText,
        extraction_type: extractionType,
      }),
      signal: controller.signal,
    })
    clearTimeout(tid)

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      throw new Error(errBody?.error || `API ${res.status}`)
    }

    const data = await res.json()
    const eraSetting = ''

    const { characters = [], appearances = [], scenes = [], props = [] } = data

    const newNodes: Node[] = []
    const newEdges: any[] = []

    // ── 放置坐标：剧本节点左侧，垂直居中排列 ──
    const baseX = scriptNode.position.x - 700
    const baseY = scriptNode.position.y
    const SPACING = 220

    // 角色节点
    const newCharacterNodes: Node[] = []
    for (let i = 0; i < characters.length; i++) {
      const nodeId = `character-hl-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`
      const nodeData = mapCharacterData(characters[i], eraSetting)
      const node: Node = {
        id: nodeId, type: 'character',
        position: { x: baseX, y: baseY + i * SPACING - Math.floor((characters.length - 1) * SPACING / 2) },
        data: nodeData, zIndex: 1000,
      }
      newNodes.push(node)
      newCharacterNodes.push(node)
      newEdges.push({ id: `e-hl-${scriptNodeId}-${nodeId}`, source: scriptNodeId, target: nodeId })
    }

    // 形象节点（尝试连到对应角色，否则连到剧本节点）
    for (let i = 0; i < appearances.length; i++) {
      const nodeId = `appearance-hl-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`
      const nodeData = mapAppearanceData(appearances[i], eraSetting)
      const appCharName: string = appearances[i].characterName || ''
      let parentId = scriptNodeId
      const matchedChar = newCharacterNodes.find(n => (n.data as any)?.name === appCharName)
      if (matchedChar) parentId = matchedChar.id

      newNodes.push({
        id: nodeId, type: 'appearance',
        position: { x: baseX - 280, y: baseY + i * SPACING - Math.floor((appearances.length - 1) * SPACING / 2) },
        data: nodeData, zIndex: 1000,
      })
      newEdges.push({ id: `e-hl-${parentId}-${nodeId}`, source: parentId, target: nodeId })
    }

    // 场景节点
    for (let i = 0; i < scenes.length; i++) {
      const nodeId = `scene-hl-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`
      newNodes.push({
        id: nodeId, type: 'scene',
        position: { x: baseX, y: baseY + i * SPACING - Math.floor((scenes.length - 1) * SPACING / 2) },
        data: mapSceneData(scenes[i], eraSetting), zIndex: 1000,
      })
      newEdges.push({ id: `e-hl-${scriptNodeId}-${nodeId}`, source: scriptNodeId, target: nodeId })
    }

    // 道具节点
    for (let i = 0; i < props.length; i++) {
      const nodeId = `prop-hl-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`
      newNodes.push({
        id: nodeId, type: 'prop',
        position: { x: baseX, y: baseY + i * SPACING - Math.floor((props.length - 1) * SPACING / 2) },
        data: mapPropData(props[i], eraSetting), zIndex: 1000,
      })
      newEdges.push({ id: `e-hl-${scriptNodeId}-${nodeId}`, source: scriptNodeId, target: nodeId })
    }

    if (newNodes.length === 0) {
      toast.error('未能从选中文本提取到有效资产')
      return
    }

    set((s) => ({
      nodes: [...s.nodes, ...newNodes],
      edges: [...s.edges, ...newEdges],
    }))

    get().setFitViewTrigger(Date.now())

    const typeLabel: Record<string, string> = {
      prop: '道具', scene: '场景', character_appearance: '角色/形象',
    }
    toast.success(`已从选中文本提取 ${newNodes.length} 个${typeLabel[extractionType] ?? ''}节点`)
  } catch (err) {
    clearTimeout(tid)
    if (err instanceof ByokConfigError) toast.error(err.message)
    else if (err instanceof Error && err.name === 'AbortError') toast.error('提取超时，请重试')
    else toast.error(`框选提取失败: ${err instanceof Error ? err.message : String(err)}`)
  }
}
