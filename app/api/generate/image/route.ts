import { NextRequest, NextResponse } from 'next/server'
import { createImageConfig } from '@/lib/openaiClient'

// 真实图像生成 API
// 支持 BYOK: 优先使用用户自定义配置，fallback 到 .env

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    // 验证必要参数
    const { prompt, width, height } = body

    if (!prompt) {
      return NextResponse.json(
        { error: '缺少必要参数: prompt' },
        { status: 400 }
      )
    }

    // 从 headers 读取 BYOK 配置（纯 BYOK 模式，不读 .env）
    const imageConfig = createImageConfig(req)
    if (!imageConfig) {
      return NextResponse.json(
        { error: '未提供 API 密钥，请在设置页面配置图像生成 API Key', status: 'failed' },
        { status: 401 }
      )
    }
    const { baseUrl, apiKey, model: geminiModel } = imageConfig

    console.log('[图像生成] 收到请求:', {
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
      width,
      height,
      model: geminiModel,
    })

    if (!baseUrl) {
      return NextResponse.json(
        { error: '未提供 API 接口地址，请在设置页面配置图像生成 Base URL', status: 'failed' },
        { status: 401 }
      )
    }

    // 生成唯一的任务 ID
    const taskId = `gemini_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // 记录开始时间
    const startTime = Date.now()

    // 调用 Gemini 图像生成 API
    // 假设 API 兼容 OpenAI 格式（如 DALL-E 或 Stable Diffusion 代理）
    const response = await fetch(`${baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: geminiModel,
        prompt,
        n: 1,
        ...(width && height ? { size: `${width}x${height}` } : { size: 'auto' }),
        response_format: 'url',
      }),
    })

    const endTime = Date.now()
    const duration = endTime - startTime

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[图像生成] API 错误:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      })
      throw new Error(`图像 API 错误: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()

    // 提取图像 URL 或 Base64 数据（根据实际 API 响应结构调整）
    let imageUrl: string
    if (result.data && result.data[0]) {
      // OpenAI 格式: { data: [{ url: '...', b64_json: '...' }] }
      const item = result.data[0]
      if (item.url) {
        imageUrl = item.url
      } else if (item.b64_json) {
        // 将 Base64 转换为 Data URL
        imageUrl = `data:image/png;base64,${item.b64_json}`
      } else {
        console.error('[图像生成] data[0] 缺少 url 或 b64_json:', JSON.stringify(item).substring(0, 200))
        throw new Error('API 返回了无效的图像数据格式')
      }
    } else if (result.images && result.images[0]) {
      // 其他格式: { images: [{ url: '...', base64: '...' }] }
      const item = result.images[0]
      if (item.url) {
        imageUrl = item.url
      } else if (item.base64) {
        imageUrl = `data:image/png;base64,${item.base64}`
      } else {
        console.error('[图像生成] images[0] 缺少 url 或 base64:', JSON.stringify(item).substring(0, 200))
        throw new Error('API 返回了无效的图像数据格式')
      }
    } else if (result.url) {
      // 直接返回 URL
      imageUrl = result.url
    } else if (result.b64_json) {
      // 直接返回 Base64
      imageUrl = `data:image/png;base64,${result.b64_json}`
    } else if (result.base64) {
      imageUrl = `data:image/png;base64,${result.base64}`
    } else {
      console.error('[图像生成] 无法解析响应结构:', JSON.stringify(result).substring(0, 500))
      throw new Error('API 返回了无法识别的图像数据格式')
    }

    console.log('[图像生成] 成功生成图像:', {
      taskId,
      duration: `${(duration / 1000).toFixed(1)}s`,
      imageUrl: imageUrl.substring(0, 100) + (imageUrl.length > 100 ? '...' : ''),
    })

    return NextResponse.json({
      status: 'completed',
      imageUrl,
      taskId,
      metadata: {
        prompt: prompt.substring(0, 200),
        ...(width && height ? { width, height } : {}),
        model: geminiModel,
        duration: `${(duration / 1000).toFixed(1)}s`,
        mock: false,
      },
    })

  } catch (error) {
    console.error('[图像生成] 服务器错误:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '图像生成服务暂时不可用',
        status: 'failed',
        taskId: `error_${Date.now()}`,
      },
      { status: 500 }
    )
  }
}

// 可选：GET 方法用于测试和文档
export async function GET() {
  return NextResponse.json({
    name: '图像生成 API',
    description: '支持 BYOK 的图像生成服务（兼容 OpenAI Images Generations 格式）',
    version: '2.0.0',
    environment: {
      baseUrl: process.env.GOOGLE_GEMINI_BASE_URL ? '已配置' : '未配置',
      apiKey: process.env.GEMINI_API_KEY ? '已配置' : '未配置',
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-image',
    },
    byok: '通过请求 headers (x-custom-base-url, x-custom-api-key, x-custom-model) 传入自定义配置',
    endpoints: {
      POST: {
        path: '/api/generate/image',
        parameters: {
          prompt: 'string (必需) - 图像生成提示词',
          width: 'number (可选) - 图像宽度',
          height: 'number (可选) - 图像高度',
        },
      },
    },
  })
}