/**
 * lib/openaiClient.ts
 *
 * 纯 BYOK 模式：所有 API 配置必须由用户通过前端设置页面提供，
 * 通过请求 headers (x-custom-*) 传入后端。
 *
 * - createScriptClient(req): 从 headers 读取 Text API 配置，缺失则返回 null
 * - createImageConfig(req): 从 headers 读取 Image API 配置，缺失则返回 null
 */

import OpenAI from 'openai'
import { NextRequest } from 'next/server'

// ── BYOK Text API 客户端 ──

export function createScriptClient(req: NextRequest): { client: OpenAI; model: string } | null {
  const apiKey = req.headers.get('x-custom-api-key') || ''
  if (!apiKey) return null

  const baseURL = req.headers.get('x-custom-base-url') || undefined
  const model = req.headers.get('x-custom-model') || 'deepseek-chat'

  const client = new OpenAI({ apiKey, baseURL })
  return { client, model }
}

// ── BYOK Image API 配置 ──

export function createImageConfig(req: NextRequest): { baseUrl: string; apiKey: string; model: string } | null {
  const apiKey = req.headers.get('x-custom-api-key') || ''
  if (!apiKey) return null

  const baseUrl = req.headers.get('x-custom-base-url') || ''
  const model = req.headers.get('x-custom-model') || 'gpt-image-1'

  return { baseUrl, apiKey, model }
}
