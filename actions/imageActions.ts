/**
 * imageActions.ts
 *
 * 从 useFlowStore 中剥离的生图业务逻辑。
 * - generateReferenceImage: 资产参考图生成
 * - generateShotImage: 分镜图像生成
 *
 * 通过接收 get/set 实现对 store 状态的读写，
 * 外部由 useFlowStore 内部挂载，对调用方透明。
 */

import { toast } from 'sonner'
import { getImageHeaders, requireImageConfig, ByokConfigError } from '@/lib/byokHeaders'

// get/set 签名（与 Zustand StoreApi 兼容）
type StoreGet = () => {
  nodes: any[]
  updateNodeData: (nodeId: string, data: Record<string, any>) => void
}
type StoreSet = (fn: (state: any) => any) => void

// ── 资产参考图生成 ──────────────────────────────────────────

export async function generateReferenceImage(
  get: StoreGet,
  nodeId: string,
  assetType: string,
  textData: any,
): Promise<void> {
  const node = get().nodes.find((n: any) => n.id === nodeId)
  if (!node) return

  // 设置生成中状态
  get().updateNodeData(nodeId, { isGeneratingRef: true })

  let timeoutId: NodeJS.Timeout | null = null
  try {
    requireImageConfig()
    // 直接使用 UI 层透传过来的精修提示词（所见即所得）
    let prompt = textData?.refinedPrompt || '';

    if (!prompt) {
      prompt = `professional concept art, cinematic lighting, highly detailed, ${assetType} reference, ${textData?.name || ''}`;
    }

    // 调用真实的图像生成 API
    const controller = new AbortController()
    timeoutId = setTimeout(() => controller.abort(), 150000) // 150秒超时

    const res = await fetch('/api/generate/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getImageHeaders() },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    timeoutId = null

    if (!res.ok) {
      throw new Error(`参考图生成失败: ${res.status}`)
    }

    const { imageUrl } = await res.json()

    // 更新节点数据，存储参考图 URL
    get().updateNodeData(nodeId, {
      referenceImage: imageUrl,
      isGeneratingRef: false,
    })
  } catch (error) {
    console.error('参考图生成失败:', error)
    if (error instanceof ByokConfigError) {
      toast.error(error.message)
    } else if (error instanceof Error && error.name === 'AbortError') {
      toast.error('参考图生成请求超时，请检查网络或 API 状态')
    } else {
      toast.error('参考图生成失败，请稍后重试')
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
    try { get().updateNodeData(nodeId, { isGeneratingRef: false }) } catch { /* storage OK */ }
  }
}

// ── 分镜图像生成 ────────────────────────────────────────────

export async function generateShotImage(
  get: StoreGet,
  imageNodeId: string,
  prompt: string,
): Promise<void> {
  const imageNode = get().nodes.find((n: any) => n.id === imageNodeId)
  if (!imageNode) return

  // 设置加载状态和生成状态
  get().updateNodeData(imageNodeId, { loading: true, status: 'generating' })

  let timeoutId: NodeJS.Timeout | null = null
  try {
    requireImageConfig()
    // 调用图像生成 API
    const controller = new AbortController()
    timeoutId = setTimeout(() => controller.abort(), 90000) // 90秒超时

    const res = await fetch('/api/generate/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getImageHeaders() },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    timeoutId = null

    if (!res.ok) {
      throw new Error(`图像生成失败: ${res.status}`)
    }

    const { imageUrl } = await res.json()

    // 更新图像节点数据
    get().updateNodeData(imageNodeId, {
      imageUrl,
      loading: false,
      status: 'completed',
      prompt,
    })
  } catch (error) {
    console.error('分镜图像生成失败:', error)
    // 设置失败状态
    get().updateNodeData(imageNodeId, { loading: false, status: 'failed' })
    if (error instanceof ByokConfigError) {
      toast.error(error.message)
    } else if (error instanceof Error && error.name === 'AbortError') {
      toast.error('图像生成请求超时，请检查网络或 API 状态')
    } else {
      toast.error('图像生成失败，请稍后重试')
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
    // 确保 loading 被清除，但保留状态（已在上面的 catch 块中设置）
  }
}
