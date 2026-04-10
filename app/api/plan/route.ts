import { NextRequest, NextResponse } from 'next/server'
import { createScriptClient } from '@/lib/openaiClient'
import { SHOT_PLANNING_SYSTEM_PROMPT, validatePlanInput } from './prompts'
import type OpenAI from 'openai'

const MAX_CONTINUATION_ROUNDS = 3

/** 尝试从截断的 JSON 中抢救已完成的 shots */
function repairTruncatedJSON(raw: string): any[] | null {
  // 先尝试直接解析
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.shots) ? parsed.shots : null
  } catch {}

  // 找最后一个完整 shot 对象边界
  const lastComplete = raw.lastIndexOf('},')
  const lastSingle = raw.lastIndexOf('}\n')
  const cutPos = Math.max(lastComplete, lastSingle)
  if (cutPos <= 0) return null

  const repaired = raw.slice(0, cutPos + 1) + ']}'
  try {
    const parsed = JSON.parse(repaired)
    return Array.isArray(parsed.shots) ? parsed.shots : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  // 1. 输入校验
  const validation = validatePlanInput(body)
  if (!validation.isValid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { scriptText, characters, scenes, props, appearances, eraSetting } = body

  // 2. 构建用户提示词
  const userContent = `
【全局时代背景设定】：
${eraSetting || '未指定（请根据剧本内容自行推断）'}

【待拆解剧本（请根据叙事节奏、动作细节与情绪转折进行高密度拆解，通常1句旁白对应1-2个关键画面切片）】：
${scriptText}

【角色资产】：
${JSON.stringify(characters, null, 2)}

【场景资产】：
${JSON.stringify(scenes, null, 2)}

【道具资产】：
${JSON.stringify(props, null, 2)}

【角色形象资产】：
${JSON.stringify(appearances, null, 2)}

请根据以上时代背景设定与资产，进行高密度分镜拆解，严格输出 shots 数组。所有分镜的视觉描述与生图提示词必须统一反映时代背景设定中的建筑风格、服装材质、光影氛围和道具质感。
`

  try {
    console.log('[API Plan] 开始分镜推演，剧本长度:', scriptText.length, '字符')

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
    let round = 0
    let needsContinuation = true

    // ── 首轮调用 ──
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: SHOT_PLANNING_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ]

    while (needsContinuation && round <= MAX_CONTINUATION_ROUNDS) {
      round++
      console.log(`[API Plan] 第 ${round} 轮调用...`)

      const completion = await client.chat.completions.create({
        model: MODEL,
        response_format: { type: 'json_object' },
        messages,
        temperature: 0.2,
        max_tokens: 8192,
      })

      const raw = completion.choices[0]?.message?.content ?? '{}'
      const finishReason = completion.choices[0]?.finish_reason
      console.log(`[API Plan] 第 ${round} 轮 finish_reason: ${finishReason}, 返回长度: ${raw.length}`)

      const shots = repairTruncatedJSON(raw)

      if (shots && shots.length > 0) {
        // 续写时编号需要接续
        if (allShots.length > 0) {
          const offset = allShots.length
          shots.forEach((s, i) => { s.num = offset + i + 1 })
        }
        allShots.push(...shots)
      }

      if (finishReason === 'length' && round <= MAX_CONTINUATION_ROUNDS) {
        // 被截断了，需要续写
        const lastNum = allShots.length
        console.log(`[API Plan] ⚠️ 第 ${round} 轮被截断（已累计 ${lastNum} 个分镜），发起续写...`)

        // 把上一轮的 assistant 回复和续写指令加入对话历史
        messages.push(
          { role: 'assistant', content: raw },
          {
            role: 'user',
            content: `你的上一轮输出因 token 限制被截断了。请从第 [${String(lastNum + 1).padStart(2, '0')}] 个分镜继续往下生成，覆盖剧本中尚未处理的剩余部分。仍然严格输出 { "shots": [...] } 格式的 JSON，编号从 ${lastNum + 1} 开始。不要重复已生成的分镜。`
          }
        )
        needsContinuation = true
      } else {
        needsContinuation = false
      }
    }

    if (allShots.length === 0) {
      return NextResponse.json(
        { error: 'AI 未能按格式生成分镜数组' },
        { status: 502 }
      )
    }

    // 重新统一编号
    allShots.forEach((s, i) => { s.num = i + 1 })

    console.log(`[API Plan] ✅ 分镜生成完成，共 ${round} 轮，累计 ${allShots.length} 个镜头`)
    return NextResponse.json({ shots: allShots, rounds: round })

  } catch (error: any) {
    const errMsg = error?.message || String(error)
    const errStatus = error?.status || error?.statusCode
    console.error('[API Plan] ❌ 调用失败:', { message: errMsg, status: errStatus, code: error?.code })

    if (errStatus) {
      return NextResponse.json(
        { error: `AI 服务错误: ${errMsg}` },
        { status: 502 }
      )
    }
    return NextResponse.json(
      { error: `分镜生成异常: ${errMsg}` },
      { status: 500 }
    )
  }
}