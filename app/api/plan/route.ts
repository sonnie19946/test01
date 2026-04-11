import { NextRequest, NextResponse } from 'next/server'
import { createScriptClient } from '@/lib/openaiClient'
import { SHOT_PLANNING_SYSTEM_PROMPT, validatePlanInput } from './prompts'

/**
 * ── 迭代式分镜生成 API ──
 *
 * 核心思路：放弃"一口气生成 + 截断抢救"的旧架构，
 * 改为每轮只请求 5-8 个分镜，并把【完整剧本 + 全部资产 + 已生成分镜历史】
 * 作为上下文注入，让大模型自行精准定位当前阅读位置，
 * 直到剧本被完全覆盖。
 *
 * 循环终止条件：大模型在输出中返回 is_finished: true
 */

const MAX_ITERATIONS = 60        // 安全阀：防止死循环（60轮 × 8个 = 最多480个分镜）
const BATCH_SIZE_HINT = '5-8'    // 每轮期望的分镜批次大小
const STALL_THRESHOLD = 3        // 连续空产出轮次上限

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

  const { scriptText, characters, scenes, props, appearances, eraSetting } = body

  try {
    console.log('[API Plan] 🚀 开始迭代式分镜生成，剧本长度:', scriptText.length, '字符')

    const scriptConfig = createScriptClient(req)
    if (!scriptConfig) {
      return NextResponse.json(
        { error: '未提供 API 密钥，请在设置页面配置剧本解析 API Key' },
        { status: 401 },
      )
    }
    const { client, model: MODEL } = scriptConfig
    console.log('[API Plan] 使用模型:', MODEL)

    const allShots: any[] = []
    let iteration = 0
    let stallCount = 0   // 连续空产出计数器

    // ── 迭代生成主循环 ──
    while (iteration < MAX_ITERATIONS) {
      iteration++
      console.log(`[API Plan] ─── 第 ${iteration} 轮迭代（已累计 ${allShots.length} 个分镜）───`)

      const userMessage = buildIterationUserMessage({
        scriptText,
        characters,
        scenes,
        props,
        appearances,
        eraSetting,
        generatedShots: allShots,
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
      console.log(`[API Plan] 第 ${iteration} 轮 finish_reason: ${finishReason}, 返回长度: ${raw.length}`)

      const result = parseIterationResponse(raw)

      if (result.error && result.new_shots.length === 0) {
        console.error(`[API Plan] ❌ 第 ${iteration} 轮解析完全失败:`, result.error)
        // 如果已经有累积分镜，不直接报错，而是用已有数据返回
        if (allShots.length > 0) {
          console.warn(`[API Plan] ⚠️ 解析失败但已有 ${allShots.length} 个分镜，提前终止并返回已有数据`)
          break
        }
        return NextResponse.json(
          { error: `AI 输出格式异常: ${result.error}` },
          { status: 502 },
        )
      }

      if (result.new_shots.length === 0) {
        // 空批次：可能是模型没有理解指令，或真的没有更多内容
        stallCount++
        console.warn(`[API Plan] ⚠️ 第 ${iteration} 轮返回 0 个分镜（连续空产出 ${stallCount}/${STALL_THRESHOLD}）`)
        if (stallCount >= STALL_THRESHOLD) {
          console.warn(`[API Plan] 连续 ${STALL_THRESHOLD} 轮空产出，强制终止循环`)
          break
        }
        continue
      }

      // 重置空产出计数
      stallCount = 0

      // 编号接续：确保全局连续
      const offset = allShots.length
      result.new_shots.forEach((s, i) => {
        s.num = offset + i + 1
      })
      allShots.push(...result.new_shots)

      console.log(`[API Plan] ✅ 第 ${iteration} 轮获得 ${result.new_shots.length} 个分镜，累计 ${allShots.length} 个，is_finished: ${result.is_finished}`)

      // ── 终止条件 ──
      if (result.is_finished) {
        console.log('[API Plan] 🏁 大模型报告 is_finished=true，剧本已完全覆盖')
        break
      }

      // 如果被截断了，这一轮的数据仍然被保留（已通过栈匹配抢救），继续下一轮
      if (finishReason === 'length') {
        console.warn(`[API Plan] ⚠️ 第 ${iteration} 轮被 token 截断，已抢救 ${result.new_shots.length} 个分镜，继续下一轮迭代...`)
      }
    }

    if (iteration >= MAX_ITERATIONS) {
      console.warn(`[API Plan] ⚠️ 达到最大迭代次数 ${MAX_ITERATIONS}，强制终止`)
    }

    if (allShots.length === 0) {
      return NextResponse.json(
        { error: 'AI 未能生成任何有效分镜' },
        { status: 502 },
      )
    }

    // 最终统一编号
    allShots.forEach((s, i) => { s.num = i + 1 })

    console.log(`[API Plan] 🎬 迭代式生成完成，共 ${iteration} 轮，累计 ${allShots.length} 个镜头`)
    return NextResponse.json({ shots: allShots, rounds: iteration })

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