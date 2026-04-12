import { NextRequest, NextResponse } from 'next/server'
import { createScriptClient } from '@/lib/openaiClient'
import { SHOT_PLANNING_SYSTEM_PROMPT, validatePlanInput } from './prompts'

export const maxDuration = 60

/**
 * ── 单轮分镜生成 API ──
 *
 * 每次请求只做一次 LLM 调用，生成 5-8 个分镜。
 * 循环控制权交给前端 shotActions.ts，通过 generatedShots 传入历史上下文。
 * 这样每个请求耗时 5-10 秒，完美兜在 Vercel Hobby 的 60s 限制内。
 */

const BATCH_SIZE_HINT = '5-8'

/** 从 AI 返回的 JSON 中提取 new_shots 和 is_finished */
function parseIterationResponse(raw: string): {
  new_shots: any[]
  is_finished: boolean
  error?: string
} {
  let cleaned = raw.trim()
  // 去 markdown 围栏
  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\n?/, '')
  else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\n?/, '')
  if (cleaned.endsWith('```')) cleaned = cleaned.replace(/\n?```$/, '')
  cleaned = cleaned.trim()

  // 1. 先尝试直接解析
  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed.new_shots)) {
      return {
        new_shots: parsed.new_shots,
        is_finished: !!parsed.is_finished,
      }
    }
    // 兼容旧格式：如果模型返回的是 { shots: [...] }
    if (Array.isArray(parsed.shots)) {
      return {
        new_shots: parsed.shots,
        is_finished: !!parsed.is_finished,
      }
    }
  } catch {}

  // 2. 栈匹配提取法：从截断 JSON 中抢救已完成的 shot 对象
  const shots: any[] = []
  const openBraces: number[] = []
  let inString = false
  let escape = false

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i]
    if (escape) { escape = false; continue }
    if (char === '\\') { escape = true; continue }
    if (char === '"') { inString = !inString; continue }
    if (!inString) {
      if (char === '{') {
        openBraces.push(i)
      } else if (char === '}') {
        if (openBraces.length > 0) {
          const start = openBraces.pop()!
          const objStr = cleaned.substring(start, i + 1)
          if (objStr.includes('"title"') && objStr.includes('"prompt"')) {
            try {
              const parsedObj = JSON.parse(objStr)
              if (parsedObj.title && typeof parsedObj.title === 'string' && parsedObj.prompt) {
                shots.push(parsedObj)
              }
            } catch {}
          }
        }
      }
    }
  }

  if (shots.length > 0) {
    // 截断场景不可能 is_finished
    return { new_shots: shots, is_finished: false }
  }

  return {
    new_shots: [],
    is_finished: false,
    error: `无法从 AI 返回中解析出任何有效分镜。前 200 字符: ${cleaned.slice(0, 200)}`,
  }
}

/** 构建每轮迭代的用户消息（注入全量上下文） */
function buildIterationUserMessage(opts: {
  scriptText: string
  characters: any[]
  scenes: any[]
  props: any[]
  appearances: any[]
  eraSetting: string
  generatedShots: any[]
  batchSize: string
}): string {
  const { scriptText, characters, scenes, props, appearances, eraSetting, generatedShots, batchSize } = opts

  const assetsBlock = `
【全局时代背景设定】：
${eraSetting || '未指定（请根据剧本内容自行推断）'}

【角色资产】：
${JSON.stringify(characters, null, 2)}

【场景资产】：
${JSON.stringify(scenes, null, 2)}

【道具资产】：
${JSON.stringify(props, null, 2)}

【角色形象资产】：
${JSON.stringify(appearances, null, 2)}`

  const scriptBlock = `
【完整剧本原文（请通读全文并对照已生成分镜历史，精确定位上次停下的位置）】：
${scriptText}`

  const historyBlock = generatedShots.length > 0
    ? `
【已生成分镜历史（共 ${generatedShots.length} 个，请仔细比对剧本原文找到上次结束的精确位置，紧接着往下提取）】：
${JSON.stringify(generatedShots, null, 2)}`
    : `
【已生成分镜历史】：
尚无。请从剧本的第一句话开始拆解。`

  return `${assetsBlock}

${scriptBlock}

${historyBlock}

请严格按照你的系统指令，紧接上次停下的位置，继续提取接下来的 ${batchSize} 个高密度分镜。
如果剧本已经被完全覆盖到最后一行，请将 is_finished 设为 true。`
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  // 1. 输入校验
  const validation = validatePlanInput(body)
  if (!validation.isValid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const {
    scriptText, characters, scenes, props, appearances,
    eraSetting, generatedShots = [],
  } = body

  try {
    const scriptConfig = createScriptClient(req)
    if (!scriptConfig) {
      return NextResponse.json(
        { error: '未提供 API 密钥，请在设置页面配置剧本解析 API Key' },
        { status: 401 },
      )
    }
    const { client, model: MODEL } = scriptConfig

    console.log(`[API Plan] 单轮调用 | 历史分镜: ${generatedShots.length} 个 | 剧本长度: ${scriptText.length} 字符 | 模型: ${MODEL}`)

    const userMessage = buildIterationUserMessage({
      scriptText,
      characters,
      scenes,
      props,
      appearances,
      eraSetting,
      generatedShots,
      batchSize: BATCH_SIZE_HINT,
    })

    const completion = await client.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SHOT_PLANNING_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 8192,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const finishReason = completion.choices[0]?.finish_reason
    console.log(`[API Plan] finish_reason: ${finishReason}, 返回长度: ${raw.length}`)

    const result = parseIterationResponse(raw)

    if (result.error && result.new_shots.length === 0) {
      console.error('[API Plan] ❌ 解析失败:', result.error)
      return NextResponse.json(
        { error: `AI 输出格式异常: ${result.error}` },
        { status: 502 },
      )
    }

    // 编号接续：基于前端传入的历史分镜数量
    const offset = generatedShots.length
    result.new_shots.forEach((s: any, i: number) => {
      s.num = offset + i + 1
    })

    if (finishReason === 'length') {
      console.warn(`[API Plan] ⚠️ 被 token 截断，已抢救 ${result.new_shots.length} 个分镜`)
    }

    console.log(`[API Plan] ✅ 返回 ${result.new_shots.length} 个新分镜，is_finished: ${result.is_finished}`)

    return NextResponse.json({
      new_shots: result.new_shots,
      is_finished: result.is_finished,
    })
  } catch (error: any) {
    const errMsg = error?.message || String(error)
    const errStatus = error?.status || error?.statusCode
    console.error('[API Plan] ❌ 调用失败:', { message: errMsg, status: errStatus, code: error?.code })

    if (errStatus) {
      return NextResponse.json(
        { error: `AI 服务错误: ${errMsg}` },
        { status: 502 },
      )
    }
    return NextResponse.json(
      { error: `分镜生成异常: ${errMsg}` },
      { status: 500 },
    )
  }
}