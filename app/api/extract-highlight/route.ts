import { NextRequest, NextResponse } from 'next/server'
import { createScriptClient } from '@/lib/openaiClient'

export const maxDuration = 60

// ── 按类型组装 system prompt ─────────────────────────────────

function buildSystemPrompt(extractionType: string): string {
  const sharedPrefix = `你是一位顶尖的影视剧本拆解专家。
用户会给你两段文本：【完整剧本】用于提供时代背景与世界观上下文，【选中片段】是用户真正要提取的目标内容。
你只需要基于【选中片段】进行提取，但必须借助【完整剧本】的世界观做深度推断。
你必须严格按照以下 JSON 格式返回，不得包含任何额外文字说明。`

  if (extractionType === 'prop') {
    return `${sharedPrefix}

{\n  "props": [\n    {\n      "name": "道具名称",\n      "desc": "剧本原文描述的忠实复述",\n      "isActual": true,\n      "appearance": {\n        "baseStructure": "基础结构与几何特征",\n        "materialAndWear": "核心材质与物理老化",\n        "interactiveTraces": "剧情使用痕迹与生物残留（强制转化为视觉）",\n        "manufacturing": "制造工艺与时代痕迹",\n        "scaleAndWeight": "体量感与视觉重量"\n      },\n      "tags": ["核心视觉标签"]\n    }\n  ]\n}

【道具三级过滤机制】：
- 只提取贯穿剧情、有特写、需独立设计的真实存在的物品（isActual=true）
- 一次性互动道具（几个便士、劣质碱皂）绝对不放入
- 场景陈设（街角水泵）绝对不放入
- 穿戴在角色身上的服装绝对不放入`
  }

  if (extractionType === 'scene') {
    return `${sharedPrefix}

{\n  "scenes": [\n    {\n      "name": "场景名称",\n      "architectureAndTopology": "建筑风格与空间拓扑",\n      "lightingAndAtmosphere": "光影系统与大气介质",\n      "materialsAndWeathering": "地表材质与自然侵蚀",\n      "staticVisualAnchors": "静态视觉锚点/陈设（剥离所有活物后的环境死物）",\n      "colorPalette": "色彩方案与分布"\n    }\n  ]\n}

【场景绝对无人空镜法则】：
- 严禁写入任何人物、动物或动态事件
- 所有生物活动必须剥离，只保留建筑、材质与光影的静态结构`
  }

  // extraction_type === 'character_appearance'：合并角色+形象一次生成
  return `${sharedPrefix}

{\n  "characters": [\n    {\n      "name": "人物姓名（代词如'他/她'输出为'主角(他)'）",\n      "gender": "男或女（强制推断，禁止填未知）",\n      "desc": "整体外貌与性格摘要",\n      "ageRange": "具体年龄段（如：30-35岁，必须推断）",\n      "tags": ["性格/职业标签"],\n      "faceDetails": {\n        "faceShape": "天生脸型骨相（强制推断，禁止填未明确）",\n        "eyes": "天生眼部轮廓（强制推断）",\n        "nose": "天生鼻部结构（强制推断）",\n        "mouth": "天生唇形（强制推断）",\n        "eyebrows": "天生眉骨与眉形（强制推断）",\n        "chin": "天生下颚骨骼（强制推断）",\n        "skinTone": "天生基础肤色肤质（强制推断）",\n        "hair": "天生发质发色（强制推断）",\n        "otherFeatures": "固定永久面部特征（如：天生黑痣/陈年旧疤，可选）"\n      }\n    }\n  ],\n  "appearances": [\n    {\n      "characterName": "所属角色姓名",\n      "versionName": "极简短形象标签（限10字，如：底层敛尸工、晚宴伪装版）",\n      "temporalState": "剧作动态特征与伤痕（如：脸颊凹陷、发紫嘴唇）",\n      "silhouette": "几何轮廓与体态痕迹",\n      "headwear": "头部配饰（非强制）",\n      "upperBody": "上半身服装材质与磨损",\n      "lowerBody": "下半身服装材质与磨损",\n      "footwear": "鞋靴材质与物理特征",\n      "accessories": "随身小物件与手部细节（非强制）",\n      "clothingIdentity": "基于着装推断的社会阶层",\n      "sensoryTranslation": "非视觉感官的视觉映射（气味/温度转化为具象画面）",\n      "colorScheme": "纯客观色彩分布",\n      "frontView": "正面构图与几何分布",\n      "backView": "背面构图与表面纹理",\n      "sideDetail": "侧面图貌细节"\n    }\n  ]\n}

【核心规则】：
1. faceDetails 只提取天生骨相，绝对不混入剧情状态（饥饿凹陷、冻伤嘴唇等），这些属于 temporalState
2. 每个出现的角色都必须同时生成对应的 appearance 条目（通过 characterName 关联）
3. 脸部特征必须强制推断，禁止填"未明确描述"
4. 女性服装也需完整填写 upperBody/lowerBody，严禁将衣物放入道具`
}

// ── 主路由 ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const selectedText: string = body.selected_text ?? ''
  const fullScript: string = body.full_script ?? ''
  const extractionType: string = body.extraction_type ?? 'character_appearance'

  if (!selectedText.trim()) {
    return NextResponse.json({ error: '请提供选中文本 (selected_text)' }, { status: 400 })
  }

  const validTypes = ['prop', 'scene', 'character_appearance']
  if (!validTypes.includes(extractionType)) {
    return NextResponse.json({ error: `不支持的提取类型: ${extractionType}` }, { status: 400 })
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

    const userMessage = `【完整剧本（仅用于理解时代背景与世界观，请勿重复提取其中已有的内容）】：
${fullScript || '（未提供完整剧本）'}

【选中片段（你真正需要提取的目标，请基于此内容生成资产）】：
${selectedText}`

    console.log(`[API Extract-Highlight] 类型: ${extractionType}, 选中文本长度: ${selectedText.length}`)

    const completion = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt(extractionType) },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    console.log(`[API Extract-Highlight] 返回长度: ${raw.length}`)

    let result: any
    try {
      result = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'AI 返回 JSON 格式异常' }, { status: 502 })
    }

    // 后端容错清理
    if (Array.isArray(result.props)) {
      result.props = result.props.filter((p: any) => p.isActual !== false)
    }

    console.log('[API Extract-Highlight] ✅ 提取完成:', {
      characters: result.characters?.length ?? 0,
      appearances: result.appearances?.length ?? 0,
      scenes: result.scenes?.length ?? 0,
      props: result.props?.length ?? 0,
    })

    return NextResponse.json({
      extraction_type: extractionType,
      characters: result.characters || [],
      appearances: result.appearances || [],
      scenes: result.scenes || [],
      props: result.props || [],
    })
  } catch (error: any) {
    const errMsg = error?.message || String(error)
    console.error('[API Extract-Highlight] ❌ 失败:', errMsg)
    return NextResponse.json({ error: `AI 服务错误: ${errMsg}` }, { status: 502 })
  }
}
