/**
 * types/nodes.ts
 *
 * 项目所有节点的 data 接口定义。
 * 替代原来分散在各节点组件中的 Record<string, any>。
 *
 * 命名规则：<NodeType>NodeData
 * 使用规则：
 *  - Node 组件中用 NodeProps<Node<XxxNodeData, 'xxx'>> 替代 Record<string,any>
 *  - actions/ 函数签名中用于替代内部的 as any 断言
 */

import type { Node } from '@xyflow/react'
import type { AssetRef, ShotItem } from '@/components/nodes/ShotPoolNode'

// ── 公共基础字段 ───────────────────────────────────────────────

/** 所有节点 data 都可能携带的通用运行时字段 */
interface BaseNodeData {
  /** 加载中状态（AI 生成时设置，不持久化）*/
  loading?: boolean
  /** 纪元背景（由剧本提取，传递给所有子节点）*/
  eraSetting?: string
  /** 满足 @xyflow/react Node<T extends Record<string, unknown>> 约束 */
  [key: string]: unknown
}

// ── 剧本节点 ──────────────────────────────────────────────────

export interface ScriptNodeData extends BaseNodeData {
  /** 剧本正文 */
  text?: string
  /** 主角姓名（手动标注或自动推断）*/
  protagonist?: string
}

export type ScriptNode = Node<ScriptNodeData, 'script'>

// ── 角色节点 ──────────────────────────────────────────────────

export interface CharacterNodeData extends BaseNodeData {
  /** 角色名 */
  name: string
  /** 性别 */
  gender?: string
  /** 年龄段 */
  ageRange?: string
  /** 角色简介 */
  summary?: string
  /** 性格标签 */
  keyTraits?: string[]
  /** 别名/代称列表 */
  aliases?: string[]
  // ── 面部细节 ──
  faceShape?: string
  eyes?: string
  nose?: string
  mouth?: string
  hair?: string
  skinTone?: string
  eyebrows?: string
  chin?: string
  otherFeatures?: string
  /** 参考图（base64 或 URL，不持久化大体积） */
  referenceImage?: string
}

export type CharacterNode = Node<CharacterNodeData, 'character'>

// ── 角色形象节点 ───────────────────────────────────────────────

export interface AppearanceNodeData extends BaseNodeData {
  /** 所属角色名 */
  characterName: string
  /** 版本名（如：出逃版、宫廷礼服版）*/
  versionName?: string
  /** 时间状态描述 */
  temporalState?: string
  /** 整体风格 */
  style?: string
  /** 体型描述 */
  bodyType?: string
  /** 服饰描述 */
  clothing?: string
  /** 配色方案 */
  colorScheme?: string
  /** 标志性特征 */
  distinctiveFeatures?: string
  /** 正面视角描述 */
  frontView?: string
  /** 背面视角描述 */
  backView?: string
  /** 侧面/细节描述 */
  sideDetail?: string
  /** 备注说明 */
  description?: string
  /** 参考图 */
  referenceImage?: string
  /** 计算显示名用的内部临时字段（不持久化）*/
  _displayName?: string
}

export type AppearanceNode = Node<AppearanceNodeData, 'appearance'>

// ── 场景节点 ──────────────────────────────────────────────────

export interface SceneNodeData extends BaseNodeData {
  /** 场景名 */
  name: string
  /** 年代/地域背景 */
  period?: string
  /** 空间描述 */
  environment?: string
  /** 光线描述 */
  lighting?: string
  /** 氛围描述 */
  atmosphere?: string
  /** 重要道具/装饰 */
  keyProps?: string
  /** 参考图 */
  referenceImage?: string
}

export type SceneNode = Node<SceneNodeData, 'scene'>

// ── 道具节点 ──────────────────────────────────────────────────

export interface PropNodeData extends BaseNodeData {
  /** 道具名 */
  name: string
  /** 外观描述 */
  desc?: string
  /** 忠实于剧本的描述（由 mapPropData 生成）*/
  faithfulnessNote?: string
  /** 参考图 */
  referenceImage?: string
}

export type PropNode = Node<PropNodeData, 'prop'>

// ── 分镜节点（独立分镜，非分镜池）──────────────────────────

export interface ShotNodeData extends BaseNodeData {
  /** 分镜标题 */
  title?: string
  /** 编号 */
  number?: string | number
  /** 情节描述 */
  plot?: string
  /** 镜头语言 */
  camera?: string
  /** 动作描述 */
  action?: string
  /** 情绪描述 */
  emotion?: string
  /** 生图提示词 */
  prompt?: string
  /** 生成图片 URL */
  imageUrl?: string
  /** 资产连接预览（连线后静默刷新）*/
  assetsPreview?: string | null
}

export type ShotNode = Node<ShotNodeData, 'shot'>

// ── 分镜池节点 ────────────────────────────────────────────────

export interface ShotPoolNodeData extends BaseNodeData {
  /** 分镜列表 */
  shots: ShotItem[]
}

export type ShotPoolNode = Node<ShotPoolNodeData, 'shot_pool'>

// ── 提示词节点 ────────────────────────────────────────────────

export interface PromptNodeData extends BaseNodeData {
  /** 最终生图提示词 */
  prompt?: string
  /** 精炼后的提示词 */
  refinedPrompt?: string
  /** 生成图片 URL */
  imageUrl?: string
}

export type PromptNodeType = Node<PromptNodeData, 'prompt'>

// ── 联合类型（画布上所有可能的节点）─────────────────────────

export type AnyFlowNode =
  | ScriptNode
  | CharacterNode
  | AppearanceNode
  | SceneNode
  | PropNode
  | ShotNode
  | ShotPoolNode
  | PromptNodeType

/** 便于 actions/ 内部做类型收窄的 data 联合 */
export type AnyNodeData =
  | ScriptNodeData
  | CharacterNodeData
  | AppearanceNodeData
  | SceneNodeData
  | PropNodeData
  | ShotNodeData
  | ShotPoolNodeData
  | PromptNodeData

// ── AssetRef 重导出（避免循环引用时直接从此文件引入）──────────

export type { AssetRef, ShotItem }
