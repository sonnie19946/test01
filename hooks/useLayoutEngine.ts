/**
 * useLayoutEngine — 基于 Dagre 的层次布局引擎
 *
 * 节点列分配（从左到右）：
 *   Col 0: prop
 *   Col 1: script, scene
 *   Col 2: character
 *   Col 3: appearance
 *   Col 4: shot_pool, shot, prompt
 */
import dagre from 'dagre'
import type { Node, Edge } from '@xyflow/react'

// 各节点类型的默认宽高（用于布局计算，需与实际渲染宽高匹配）
const NODE_DIMENSIONS: Record<string, { w: number; h: number }> = {
  script:    { w: 270, h: 340 },
  character: { w: 270, h: 140 },
  appearance:{ w: 270, h: 150 },
  scene:     { w: 270, h: 140 },
  prop:      { w: 270, h: 140 },
  shot:      { w: 260, h: 420 },
  shot_pool: { w: 380, h: 480 },
  prompt:    { w: 260, h: 180 },
}
const DEFAULT_DIM = { w: 270, h: 140 }

// 强制列序（数字越小在越左）
const COLUMN_RANK: Record<string, number> = {
  prop:       0,
  scene:      1,
  script:     1,
  character:  2,
  appearance: 3,
  shot_pool:  4,
  shot:       4,
  prompt:     5,
}

interface LayoutOptions {
  rankDir?: 'LR' | 'TB'
  /** 同列节点间纵向间距 */
  nodeSep?: number
  /** 相邻列之间横向间距 */
  rankSep?: number
}

/**
 * 纯函数：把当前 nodes/edges 经过 Dagre 重新定位后返回新的 nodes 数组。
 * 不会 mutate 参数，可安全在 React 之外调用。
 */
export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  if (nodes.length === 0) return nodes

  const { rankDir = 'LR', nodeSep = 15, rankSep = 140 } = options

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: rankDir,
    nodesep: nodeSep,
    ranksep: rankSep,
    marginx: 60,
    marginy: 60,
  })

  // 注册节点（含强制 rank）
  for (const node of nodes) {
    const dim = NODE_DIMENSIONS[node.type ?? ''] ?? DEFAULT_DIM
    g.setNode(node.id, {
      width:  dim.w,
      height: dim.h,
      // 用 rank 强制列顺序（Dagre 的 rank 概念）
      rank: COLUMN_RANK[node.type ?? ''] ?? 3,
    })
  }

  // 注册边
  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  }

  dagre.layout(g)

  return nodes.map((node) => {
    const pos = g.node(node.id)
    if (!pos) return node
    const dim = NODE_DIMENSIONS[node.type ?? ''] ?? DEFAULT_DIM
    return {
      ...node,
      position: {
        x: pos.x - dim.w / 2,
        y: pos.y - dim.h / 2,
      },
      // 标记已布局，防止 ReactFlow 内部 position 协调覆盖
      positionAbsolute: {
        x: pos.x - dim.w / 2,
        y: pos.y - dim.h / 2,
      },
    }
  })
}
