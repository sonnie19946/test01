import { NextRequest, NextResponse } from 'next/server'
import { createScriptClient } from '@/lib/openaiClient'
import { SHOT_PLANNING_SYSTEM_PROMPT, validatePlanInput } from './prompts'
import type OpenAI from 'openai'

const MAX_CONTINUATION_ROUNDS = 3

/** 尝试从截断的 JSON 中绝地抢救已完成的 shot 对象 */
function repairTruncatedJSON(raw: string): any[] | { error: string } {
  // 1. 强力去除所有可能的 markdown 标记
  let cleaned = raw.trim()
  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\n?/, '')
  else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\n?/, '')
  if (cleaned.endsWith('```')) cleaned = cleaned.replace(/\n?```$/, '')
  cleaned = cleaned.trim()

  // 2. 先尝试直接解析（如果一次性返回完整结果）
  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed.shots)) return parsed.shots
  } catch {}

  // 3. 栈匹配提取法：无视所有的截断点和缺失的尾部括号，直接扫描并提取所有完整闭合的 JSON 对象
  const shots: any[] = []
  const openBraces: number[] = []
  let inString = false
  let escape = false

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i]

    if (escape) {
      escape = false
      continue
    }

    if (char === '\\') {
      escape = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (!inString) {
      if (char === '{') {
        openBraces.push(i)
      } else if (char === '}') {
        if (openBraces.length > 0) {
          const start = openBraces.pop()!
          const objStr = cleaned.substring(start, i + 1)
          
          // 初筛：只尝试解析带有镜头核心字段的子串
          if (objStr.includes('"title"') && objStr.includes('"prompt"')) {
            try {
              const parsedObj = JSON.parse(objStr)
              // 再次确认为有效的镜头对象
              if (parsedObj.title && typeof parsedObj.title === 'string' && parsedObj.prompt) {
                shots.push(parsedObj)
              }
            } catch (e) {
              // 局部解析失败，直接忽略
            }
          }
        }
      }
    }
  }

  if (shots.length > 0) {
    return shots
  }

  return { error: `栈匹配抢救失败，未能提取出任何完整有效的分镜结构。前 100 字符: ${cleaned.slice(0, 100)}` }
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
    let lastRaw = ''
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
      lastRaw = raw
      const finishReason = completion.choices[0]?.finish_reason
      console.log(`[API Plan] 第 ${round} 轮 finish_reason: ${finishReason}, 返回长度: ${raw.length}`)

      const parseResult = repairTruncatedJSON(raw)
      let shots: any[] = []

      if (Array.isArray(parseResult)) {
        shots = parseResult
      } else {
        console.error(`[API Plan] ❌ 第 ${round} 轮 JSON 解析与抢救彻底失败:`, parseResult.error)
        return NextResponse.json(
          { error: `由于大模型输出过长导致格式破损，抢救数据失败。具体原因: ${parseResult.error}` },
          { status: 502 }
        )
      }

      if (shots.length > 0) {
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

        // 注意：我们只把成功清理并闭合抢救过后的 JSON 塞回历史记录，否则纯断裂字符串容易带偏下一轮
        const safeAssistantContent = JSON.stringify({ shots }, null, 2)
        
        messages.push(
          { role: 'assistant', content: safeAssistantContent },
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
      console.error('[API Plan] ❌ AI 返回内容无法解析为 shots 数组，原始返回（前2000字符）:', lastRaw.slice(0, 2000))
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