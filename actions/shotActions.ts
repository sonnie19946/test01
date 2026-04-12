/**
 * shotActions.ts
 *
 * 从 useFlowStore 中剥离的分镜池业务逻辑。
 * - generateShotPool: 调用 /api/plan、逐条动画展示分镜
 * - refreshShotAssets: 连线时静默刷新分镜资产预览
 *
 * 通过接收 get/set 无缝读写主 store 状态。
 */

import { Node, Edge } from '@xyflow/react'
import { toast } from 'sonner'
import { getScriptHeaders, requireScriptConfig, ByokConfigError } from '@/lib/byokHeaders'
import { getAssetDisplayName } from '@/lib/getAssetDisplayName'
import type { AssetRef } from '@/components/nodes/ShotPoolNode'

// ── Store 访问器类型 ────────────────────────────────────────

type StoreGet = () => {
  nodes: Node[]
  edges: Edge[]
  updateNodeData: (nodeId: string, data: Record<string, any>) => void
  autoLayout: () => void
  setFitViewTrigger: (trigger: number) => void
}
type StoreSet = (fn: (state: { nodes: Node[] }) => Partial<{ nodes: Node[] }>) => void

// ── generateShotPool ────────────────────────────────────────

const MAX_ITERATIONS = 60     // 安全阀（60 × 8 = 最多 480 个分镜）
const STALL_THRESHOLD = 3     // 连续空产出轮次上限

export async function generateShotPool(
  get: StoreGet,
  set: StoreSet,
  poolNodeId: string,
): Promise<void> {
  const poolNode = get().nodes.find(n => n.id === poolNodeId)
  if (!poolNode) return

  get().updateNodeData(poolNodeId, { loading: true, shots: [] })

  try {
    requireScriptConfig()
    // 1. 收集连入的资产节点
    const incomingEdges = get().edges.filter(e => e.target === poolNodeId)
    const sourceNodeIds = incomingEdges.map(e => e.source)
    const sourceNodes = get().nodes.filter(n => sourceNodeIds.includes(n.id))

    const characters: Array<{ name: string; desc?: string; tags?: string[] }> = []
    const scenes: Array<{ name: string; desc?: string; lighting?: string }> = []
    const props: Array<{ name: string; desc?: string }> = []
    const appearances: Array<{ name: string; desc?: string }> = []
    let scriptText = ''

    for (const node of sourceNodes) {
      switch (node.type) {
        case 'scene':
          scenes.push({ name: (node.data as any).name || '', desc: (node.data as any).environment || '' })
          break
        case 'prop':
          props.push({ name: (node.data as any).name || '', desc: (node.data as any).faithfulnessNote || '' })
          break
        case 'appearance': {
          const apd = node.data as any
          const apName = getAssetDisplayName('appearance', apd)
          appearances.push({ name: apName, desc: apd.style || apd.description || '' })
          break
        }
      }
    }

    // 2. 三跳找剧本文字 + 角色数据 (pool←appearance←character←script)
    if (!scriptText) {
      const assetNodes = sourceNodes.filter(n => ['appearance', 'scene', 'prop'].includes(n.type || ''))
      outer: for (const asset of assetNodes) {
        for (const edge of get().edges.filter(e => e.target === asset.id)) {
          const direct = get().nodes.find(n => n.id === edge.source && n.type === 'script')
          if (direct) { scriptText = (direct.data as any).text || ''; if (scriptText) break outer }
          const char = get().nodes.find(n => n.id === edge.source && n.type === 'character')
          if (char) {
            const cd = char.data as any
            if (!characters.find(c => c.name === cd.name))
              characters.push({ name: cd.name || '', desc: cd.summary || '', tags: cd.keyTraits || [] })
            for (const ce of get().edges.filter(e => e.target === char.id)) {
              const script = get().nodes.find(n => n.id === ce.source && n.type === 'script')
              if (script) { scriptText = (script.data as any).text || ''; if (scriptText) break outer }
            }
          }
        }
      }
    }

    if (!scriptText) scriptText = '未提供剧本文本'

    // 2.5 收集 eraSetting（从分镜池节点自身或连入资产节点上获取）
    let eraSetting = (poolNode.data as any)?.eraSetting || ''
    if (!eraSetting) {
      for (const node of sourceNodes) {
        const era = (node.data as any)?.eraSetting
        if (era) { eraSetting = era; break }
      }
    }

    // 3. 构建资产名称 → 节点ID 的查找表（用于解析 AI 返回的 refs 字符串数组）
    const allAssetNodes = get().nodes.filter(n =>
      ['character', 'appearance', 'scene', 'prop'].includes(n.type || '')
    )
    const nameToNode = new Map<string, { id: string; type: string; name: string }>()
    // 先注册非 appearance 节点（优先级低，会被 appearance 覆盖）
    for (const n of allAssetNodes.filter(n => n.type !== 'appearance')) {
      const d = n.data as Record<string, any>
      const name = getAssetDisplayName(n.type, d)
      if (name) nameToNode.set(name, { id: n.id, type: n.type || '', name })
    }
    // 再注册 appearance 节点（优先级高，同名键会覆盖 character）
    for (const n of allAssetNodes.filter(n => n.type === 'appearance')) {
      const d = n.data as Record<string, any>
      const name = getAssetDisplayName(n.type, d)
      if (name) nameToNode.set(name, { id: n.id, type: n.type || '', name })
      // 用原始 characterName 做 fallback 键（覆盖同名 character 节点）
      if (d?.characterName) {
        nameToNode.set(d.characterName, { id: n.id, type: n.type || '', name })
      }
    }

    const resolveRefs = (aiRefs: string[] | undefined): AssetRef[] => {
      if (!Array.isArray(aiRefs)) return []
      const result: AssetRef[] = []
      const seen = new Set<string>()
      for (const refName of aiRefs) {
        if (typeof refName !== 'string') continue
        const matched = nameToNode.get(refName.trim())
        if (matched && !seen.has(matched.id)) {
          seen.add(matched.id)
          result.push({ nodeId: matched.id, type: matched.type, name: matched.name })
        }
      }
      return result
    }

    // ── 4. 迭代生成主循环（每轮一次 HTTP 请求 → 5-8 个分镜） ──
    const allGeneratedShots: any[] = [] // 发送给 API 的历史上下文（原始 AI 数据）
    let iteration = 0
    let stallCount = 0

    toast.info('开始迭代式分镜生成...')

    while (iteration < MAX_ITERATIONS) {
      iteration++
      console.log(`[generateShotPool] ─── 第 ${iteration} 轮（已累计 ${allGeneratedShots.length} 个分镜）───`)

      // 每轮单独的 AbortController（55s 超时，留 5s 余量给 Vercel 60s 限制）
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(new Error('single round timeout')), 55000)

      let res: Response
      try {
        res = await fetch('/api/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getScriptHeaders() },
          body: JSON.stringify({
            scriptText, characters, scenes, props, appearances, eraSetting,
            generatedShots: allGeneratedShots,
          }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
      } catch (fetchErr) {
        clearTimeout(timeoutId)
        // 网络/超时错误：如果已有分镜，优雅降级
        if (allGeneratedShots.length > 0) {
          console.warn(`[generateShotPool] 第 ${iteration} 轮网络失败，已有 ${allGeneratedShots.length} 个分镜，提前终止`)
          toast.warning(`第 ${iteration} 轮请求失败，已保留前 ${allGeneratedShots.length} 个分镜`)
          break
        }
        throw fetchErr
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        const detail = errBody?.error || `${res.status} ${res.statusText}`
        if (allGeneratedShots.length > 0) {
          console.warn(`[generateShotPool] 第 ${iteration} 轮 API 错误: ${detail}，提前终止`)
          toast.warning(`第 ${iteration} 轮失败，已保留前 ${allGeneratedShots.length} 个分镜`)
          break
        }
        throw new Error(`分镜生成失败: ${detail}`)
      }

      const { new_shots = [], is_finished = false } = await res.json()

      // 空批次处理
      if (new_shots.length === 0) {
        stallCount++
        console.warn(`[generateShotPool] 第 ${iteration} 轮返回 0 个分镜（连续空产出 ${stallCount}/${STALL_THRESHOLD}）`)
        if (stallCount >= STALL_THRESHOLD) {
          console.warn(`[generateShotPool] 连续 ${STALL_THRESHOLD} 轮空产出，强制终止`)
          break
        }
        continue
      }

      stallCount = 0
      allGeneratedShots.push(...new_shots)

      // ── 逐条动画追加到 UI（瀑布流效果） ──
      const baseIdx = allGeneratedShots.length - new_shots.length
      for (let i = 0; i < new_shots.length; i++) {
        const s = new_shots[i]
        const globalIdx = baseIdx + i
        const shotId = `si-${poolNodeId}-${globalIdx}`

        // 追加为 generating 状态
        set(state => ({
          nodes: state.nodes.map(n => n.id !== poolNodeId ? n : {
            ...n, data: {
              ...n.data,
              shots: [
                ...(n.data as any).shots,
                {
                  id: shotId,
                  num: globalIdx + 1,
                  title: '', plot: '', camera: '', action: '', emotion: '',
                  status: 'generating' as const,
                  refs: [],
                },
              ],
            },
          }),
        }))
        await new Promise(r => setTimeout(r, 300))

        // 填充真实数据，标记 done
        set(state => ({
          nodes: state.nodes.map(n => n.id !== poolNodeId ? n : {
            ...n, data: {
              ...n.data,
              shots: (n.data as any).shots.map((item: any) =>
                item.id === shotId ? {
                  ...item,
                  title: s.nodeName || s.title || `分镜 ${String(globalIdx + 1).padStart(2, '0')}`,
                  plot: s.plot || s.scenario || '',
                  camera: s.camera || '',
                  action: s.action || '',
                  emotion: s.emotion || '',
                  prompt: s.prompt || '',
                  refs: resolveRefs(s.refs),
                  status: 'done',
                } : item,
              ),
            },
          }),
        }))
        await new Promise(r => setTimeout(r, 120))
      }

      console.log(`[generateShotPool] ✅ 第 ${iteration} 轮完成，+${new_shots.length} 个，累计 ${allGeneratedShots.length} 个`)
      toast.info(`第 ${iteration} 轮完成，已累计 ${allGeneratedShots.length} 个分镜${is_finished ? '（剧本已覆盖完毕）' : '...'}`)

      // ── 终止条件 ──
      if (is_finished) {
        console.log('[generateShotPool] 🏁 is_finished=true，剧本已完全覆盖')
        break
      }
    }

    if (iteration >= MAX_ITERATIONS) {
      console.warn(`[generateShotPool] ⚠️ 达到最大迭代次数 ${MAX_ITERATIONS}，强制终止`)
    }

    if (allGeneratedShots.length === 0) {
      throw new Error('AI 未返回有效分镜数据')
    }

    get().updateNodeData(poolNodeId, { loading: false })
    toast.success(`分镜池生成完成，共 ${allGeneratedShots.length} 个分镜（${iteration} 轮迭代）`)
    // 重新布局，让分镜池出现在正确位置
    get().autoLayout()
  } catch (err) {
    console.error('[generateShotPool]', err)
    if (err instanceof ByokConfigError)
      toast.error(err.message)
    else if (err instanceof Error && err.name === 'AbortError')
      toast.error('分镜生成超时')
    else
      toast.error('分镜池生成失败')
    get().updateNodeData(poolNodeId, { loading: false })
  }
}

// ── refreshShotAssets ───────────────────────────────────────

export function refreshShotAssets(
  get: StoreGet,
  shotNodeId: string,
): void {
  const shotNode = get().nodes.find((n) => n.id === shotNodeId)
  if (!shotNode) return

  // 1. 找到所有连接到 shotNode 的边 (target 是 shotNodeId)
  const incomingEdges = get().edges.filter((e) => e.target === shotNodeId)

  // 2. 收集所有源节点 ID
  const sourceNodeIds = incomingEdges.map((e) => e.source)
  const sourceNodes = get().nodes.filter((n) => sourceNodeIds.includes(n.id))

  // 3. 统计资产类型数量
  const assetCount = sourceNodes.filter(n =>
    ['character', 'appearance', 'scene', 'prop'].includes(n.type ?? '')
  ).length

  // 4. 如果已有资产连接，更新 shotNode 的 assetsPreview 字段（用于 UI 提示）
  if (assetCount > 0) {
    const previewText = `已连接 ${assetCount} 项资产`
    get().updateNodeData(shotNodeId, { assetsPreview: previewText })
  } else {
    get().updateNodeData(shotNodeId, { assetsPreview: null })
  }
}
