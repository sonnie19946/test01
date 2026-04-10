/**
 * nodeDataMappers.ts
 * 
 * 将 API 返回的原始数据（characters/scenes/props/appearances）
 * 映射为节点 data 的纯函数。
 * 
 * 三处调用方：extractAssets / extractByType / fillNodeWithAI
 * 统一在此维护，避免重复。
 */

import type { CharacterNodeData, AppearanceNodeData, SceneNodeData, PropNodeData } from '@/types/nodes'

// ── 角色 ──────────────────────────────────────────────────────

/** 处理代称（"你/她/他/它" → "主角(X)"） */
export function normalizeCharacterName(rawName: string): string {
  if (!rawName) return '未知角色'
  if (rawName.length <= 2 && ['你', '她', '他', '它'].includes(rawName)) {
    return `主角(${rawName})`
  }
  return rawName
}

/**
 * 将 API 返回的单个 character JSON 映射为 CharacterNode.data
 */
export function mapCharacterData(
  raw: Record<string, any>,
  eraSetting: string,
): CharacterNodeData {
  const face = raw.faceDetails || {}
  return {
    name: normalizeCharacterName(raw.name || ''),
    eraSetting,
    gender: raw.gender || '未知',
    ageRange: raw.ageRange || '未知',
    summary: raw.desc || '',
    keyTraits: Array.isArray(raw.tags) ? raw.tags : (raw.tags ? [raw.tags] : []),
    faceShape: face.faceShape || '',
    eyes: face.eyes || '',
    nose: face.nose || '',
    mouth: face.mouth || '',
    hair: face.hair || '',
    skinTone: face.skinTone || '',
    eyebrows: face.eyebrows || '',
    chin: face.chin || '',
    otherFeatures: face.otherFeatures || '',
    aliases: [],
  }
}

// ── 场景 ──────────────────────────────────────────────────────

/**
 * 将 API 返回的单个 scene JSON 映射为 SceneNode.data
 */
export function mapSceneData(
  raw: Record<string, any>,
  eraSetting: string,
): SceneNodeData {
  return {
    ...raw,
    name: raw.name || '未知场景',
    eraSetting,
  }
}

// ── 道具 ──────────────────────────────────────────────────────

/**
 * 将 API 返回的单个 prop JSON 映射为 PropNode.data
 */
export function mapPropData(
  raw: Record<string, any>,
  eraSetting: string,
): PropNodeData {
  return {
    ...raw,
    name: raw.name || '未知道具',
    eraSetting,
    faithfulnessNote: `剧本原文描述的忠重复述：${raw.desc || '（无描述）'}`,
  }
}

// ── 角色形象 ──────────────────────────────────────────────────

/**
 * 将 API 返回的单个 appearance JSON 映射为 AppearanceNode.data
 */
export function mapAppearanceData(
  raw: Record<string, any>,
  eraSetting: string,
): AppearanceNodeData {
  return {
    ...raw,
    characterName: raw.characterName || raw.name || '未知角色',
    eraSetting,
  }
}

// ── 统一按类型分派 ────────────────────────────────────────────

/**
 * 根据节点类型字符串，自动选择对应的 mapper。
 * 用于 extractByType / fillNodeWithAI 等需要动态决定映射的场景。
 */
export function mapNodeData(
  assetType: string,
  raw: Record<string, any>,
  eraSetting: string,
): Record<string, any> {
  switch (assetType) {
    case 'character':
      return mapCharacterData(raw, eraSetting)
    case 'scene':
      return mapSceneData(raw, eraSetting)
    case 'prop':
      return mapPropData(raw, eraSetting)
    case 'appearance':
      return mapAppearanceData(raw, eraSetting)
    default:
      return { ...raw, name: raw.name || '' }
  }
}

/**
 * 为 extractByType 的去重逻辑生成 matchKey。
 */
export function getMatchKey(
  assetType: string,
  nodeData: Record<string, any>,
  raw: Record<string, any>,
): string {
  if (assetType === 'appearance') {
    return `${nodeData.characterName}-${raw.versionName || ''}`
  }
  return nodeData.name || ''
}
