import { NextRequest, NextResponse } from 'next/server'
import { createScriptClient } from '@/lib/openaiClient'
import { EXTRACT_SYSTEM_PROMPT } from './prompts'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const scriptText: string = body.scriptText ?? ''

  if (!scriptText.trim()) {
    return NextResponse.json(
      { error: '请提供剧本文本 (scriptText)' },
      { status: 400 },
    )
  }

  try {
    const scriptConfig = createScriptClient(req)
    if (!scriptConfig) {
      return NextResponse.json(
        { error: '未提供 API 密钥，请在设置页面配置剧本解析 API Key' },
        { status: 401 },
      )
    }
    const { client, model } = scriptConfig

    console.log('[API Extract] 开始调用 AI，剧本长度:', scriptText.length, '字符')
    console.log('[API Extract] 使用模型:', model)

    const completion = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
        { role: 'user', content: `请基于规范深度拆解以下剧本：\n\n${scriptText}` },
      ],
      temperature: 0.1,
      max_tokens: 8192,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const finishReason = completion.choices[0]?.finish_reason
    console.log('[API Extract] AI finish_reason:', finishReason)
    console.log('[API Extract] AI 返回长度:', raw.length, '字符')

    // 如果 finish_reason 是 length，说明 JSON 被截断了
    if (finishReason === 'length') {
      console.error('[API Extract] ⚠️ AI 返回被截断（token 不足），JSON 可能不完整')
    }

    let result: any
    try {
      result = JSON.parse(raw)
    } catch (parseErr) {
      console.error('[API Extract] JSON 解析失败，原始返回前500字符:', raw.slice(0, 500))
      console.error('[API Extract] JSON 解析错误:', parseErr)
      return NextResponse.json(
        { error: 'AI 返回的 JSON 格式异常，无法解析', detail: String(parseErr) },
        { status: 502 }
      )
    }

    // 后端容错：清理可能因为 AI 幻觉被放入的 isActual 为 false 的非实体道具
    const validProps = (result.props || []).filter((p: any) => p.isActual !== false)

    // 确保所有场景都有 visualAnchors 字段
    const safeScenes = (result.scenes || []).map((s: any) => ({
      ...s,
      visualAnchors: Array.isArray(s.visualAnchors) && s.visualAnchors.length > 0
        ? s.visualAnchors
        : [s.location || '未知环境特征']
    }))

    const safeResult = {
      eraSetting: result.eraSetting || '未明确（请根据剧本内容推断）',
      characters: result.characters || [],
      scenes: safeScenes,
      props: validProps,
      appearances: result.appearances || []
    }

    console.log('[API Extract] ✅ 提取完成:', {
      eraSetting: safeResult.eraSetting,
      characters: safeResult.characters.length,
      scenes: safeResult.scenes.length, 
      props: safeResult.props.length,
      appearances: safeResult.appearances.length,
    })

    return NextResponse.json(safeResult)
  } catch (error: any) {
    // 区分不同类型的错误
    const errMsg = error?.message || String(error)
    const errStatus = error?.status || error?.statusCode
    console.error('[API Extract] ❌ 调用失败:', {
      message: errMsg,
      status: errStatus,
      type: error?.type,
      code: error?.code,
      name: error?.name,
    })

    // 如果是 OpenAI SDK 抛出的 API 错误，透传状态码
    if (errStatus) {
      return NextResponse.json(
        { error: `AI 服务错误: ${errMsg}`, status: errStatus },
        { status: 502 }
      )
    }

    return NextResponse.json(
      { error: `服务端异常: ${errMsg}` },
      { status: 500 }
    )
  }
}
