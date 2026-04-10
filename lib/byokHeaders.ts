/**
 * lib/byokHeaders.ts
 *
 * 前端 BYOK 工具函数：
 * - getScriptHeaders / getImageHeaders：注入 headers
 * - requireScriptConfig / requireImageConfig：前置断言，缺配置直接 throw
 *
 * ⚠️ 只能在客户端组件/actions 中调用（依赖 Zustand store）。
 */

import { useSettingsStore } from '@/hooks/useSettingsStore'

/** BYOK 配置缺失时抛出的特定错误类型 */
export class ByokConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ByokConfigError'
  }
}

/** 断言剧本解析 API 配置已就绪，否则 throw ByokConfigError */
export function requireScriptConfig() {
  const { scriptApiKey } = useSettingsStore.getState()
  if (!scriptApiKey) {
    throw new ByokConfigError('请先前往「设置」页面，配置您的剧本解析 API 密钥（API Key）')
  }
}

/** 断言图像生成 API 配置已就绪，否则 throw ByokConfigError */
export function requireImageConfig() {
  const { imageApiKey } = useSettingsStore.getState()
  if (!imageApiKey) {
    throw new ByokConfigError('请先前往「设置」页面，配置您的图像生成 API 密钥（API Key）')
  }
}

/** 获取剧本解析 API 的 BYOK headers */
export function getScriptHeaders(): Record<string, string> {
  const { scriptBaseUrl, scriptApiKey, scriptModel } = useSettingsStore.getState()
  const h: Record<string, string> = {}
  if (scriptBaseUrl) h['x-custom-base-url'] = scriptBaseUrl
  if (scriptApiKey) h['x-custom-api-key'] = scriptApiKey
  if (scriptModel) h['x-custom-model'] = scriptModel
  return h
}

/** 获取图像生成 API 的 BYOK headers */
export function getImageHeaders(): Record<string, string> {
  const { imageBaseUrl, imageApiKey, imageModel } = useSettingsStore.getState()
  const h: Record<string, string> = {}
  if (imageBaseUrl) h['x-custom-base-url'] = imageBaseUrl
  if (imageApiKey) h['x-custom-api-key'] = imageApiKey
  if (imageModel) h['x-custom-model'] = imageModel
  return h
}
