import { NextRequest, NextResponse } from 'next/server'
import { createScriptClient } from '@/lib/openaiClient'

// ── 按类型组装 system prompt ─────────────────────────────────

function buildSystemPrompt(extractionType: string): string {

  // ─────────── 道具师（Prop Master） ───────────
  if (extractionType === 'prop') {
    return `你是好莱坞 A 级制片厂的首席道具师（Prop Master）。
你在电影工业管线中的职责是：从剧本中精准筛选出**对叙事有推动作用、或具备极强视觉奇观的核心物件**，为概念设计师提供精确的工业级参考数据。

用户会给你两段文本：
- 【完整剧本】：用于理解时代背景与世界观。
- 【选中片段】：你真正要提取的目标内容。

你必须严格按照以下 JSON 格式返回，不得包含任何额外文字说明：

{
  "props": [
    {
      "name": "道具名称",
      "desc": "剧本原文描述的忠实复述",
      "isActual": true,
      "appearance": {
        "baseStructure": "基础结构与几何特征（如：倒梯形车斗，带有双木轮支撑）",
        "materialAndWear": "核心材质与物理老化（如：发灰泛白的粗糙原木，边缘伴有严重腐朽断茬）",
        "interactiveTraces": "剧情使用痕迹与生物残留（强制转化为视觉，如：车底板渗透有陈旧黑色血渍）",
        "manufacturing": "制造工艺与时代痕迹（如：粗劣的生锈铁钉强行钉合，手工粗糙拼凑感）",
        "scaleAndWeight": "体量感与视觉重量（如：沉重、重心极低的中型物件）"
      },
      "tags": ["核心视觉标签"]
    }
  ]
}

【道具5级猎杀过滤（你的核心纪律）】：

1级 ✅ 核心叙事道具（唯一允许入选的类别）：
  - 贯穿剧情、有角色互动特写、或承载重要象征意义的物件。
  - 必须是剧情发展不可或缺的"角色级道具"——如果把它从剧本中删除，叙事逻辑会断裂。
  - 典型入选：凶器、信件、关键钥匙、主角的标志性随身物。

2级 ❌ 一次性互动道具（严禁入选）：
  - 角色顺手使用、用完即弃、无剧情后续的物品。
  - 如：几个便士、一块碱皂、一杯水、一根火柴。

3级 ❌ 场景陈设/固定设施（严禁入选）：
  - 属于环境的固有组成部分，不可被角色带走。
  - 如：街角水泵、路灯、吧台、桌椅。这些应由场景节点负责。

4级 ❌ 角色服装（严禁入选）：
  - 任何穿戴在角色身上的服装（燕尾服、靴子、手套、围巾等）绝对不可作为道具。
  - 服装属于角色形象（appearance）节点的管辖范围。

5级 ❌ 低视觉张力废话道具（严禁入选）：
  - "一扇门"、"一把椅子"、"一个杯子"——这种毫无视觉设计价值的日常物件，坚决不要。
  - 如果这个道具在现实中随手可买到且外观平凡无奇，它就不配出现在你的清单里。

【质量底线】：宁可只提取 1-2 个真正有分量的核心道具，也绝不凑数提交一堆废话。空数组 [] 比垃圾数据更有价值。`
  }

  // ─────────── 电影美术指导（Production Designer） ───────────
  if (extractionType === 'scene') {
    return `你是奥斯卡最佳美术指导级别的电影空间设计大师（Production Designer）。
你在电影工业管线中的职责是：为每个叙事空间构建一张精确的"空舞台蓝图"——这是在演员进场之前、摄影指导布光之前，美术部门必须交付的环境基底数据。

用户会给你两段文本：
- 【完整剧本】：用于理解时代背景与世界观。
- 【选中片段】：你真正要提取的目标内容。

你必须严格按照以下 JSON 格式返回，不得包含任何额外文字说明：

{
  "scenes": [
    {
      "name": "场景名称",
      "architectureAndTopology": "建筑风格与空间拓扑（如：维多利亚时代的贫民窟，逼仄的线性街道，高耸倾斜的砖木建筑夹出一线天空）",
      "lightingAndAtmosphere": "光影系统与大气介质（如：清晨漫反射的冷灰光线穿过浓厚的丁达尔体积雾，无直射主光源，仅有墙缝渗出的微弱暖黄色人工光）",
      "materialsAndWeathering": "地表材质与自然侵蚀（如：湿滑反光的黑色青石板，墙根长满潮湿苔藓，砖缝流淌着缓慢渗出的黑色黏液）",
      "staticVisualAnchors": "静态视觉锚点/陈设（剥离活物后，环境中最抓眼的死物，如：巷道尽头一座歪斜的生锈铁炉、墙角堆积的成堆腐烂垃圾与散落的碎瓦片）",
      "colorPalette": "色彩方案与分布（如：大面积冷灰与暗青色主导，建筑阴影呈深蓝紫色，局部有锈红色的微弱点缀来自一处破旧铁门）"
    }
  ]
}

【空舞台铁律（你的核心纪律）】：

1. 绝对无人空镜：场景 = 开拍前的空舞台。严禁写入任何人物、动物（行人、野狗、老鼠）或动态事件（有人在跑、门被推开）。所有生物活动必须斩草除根，全部剥离，这些元素由分镜节点负责。

2. 五感视觉化：你只有一台摄影机，没有麦克风和鼻子。
   - "喧闹的"→ 翻译为"墙面贴满层层叠叠的泛黄告示，地面散落被踩碎的纸屑"
   - "恶臭的"→ "排水沟口覆盖着一层泛绿的粘稠膜状物"
   - "寒冷的"→ "所有金属表面凝结了一层薄薄的白色霜花"

3. 时代考古学：你必须根据完整剧本推断出的时代背景，为建筑风格、材料质感、光源类型做强制校准。
   - 19世纪→ 煤气灯/烛光/砖石结构
   - 二战时期→ 混凝土碉堡/电灯泡/军用铁丝网
   - 近未来→ 全息投影/纳米涂层/环境自适应照明

4. 构图思维：每个字段都应暗含"如果我站在这个空间中央，向前看会看到什么"的构图意识。`
  }

  // ─────────── 顶级选角导演与造型指导（Casting Director + Costume Designer） ───────────
  return `你同时担任两个角色：**顶级选角导演（Casting Director）** 与 **造型指导（Costume Designer）**。

作为选角导演，你的任务是为每个角色精准"捏脸"——定义其天生的骨骼结构、生理底色，创造一张在任何剧情状态下都不变的"出厂面孔"。
作为造型指导，你的任务是为每个角色在每个剧情阶段设计完整的视觉形象——从头到脚的服装、配饰、体态、以及剧情留下的物理痕迹。

用户会给你两段文本：
- 【完整剧本】：用于理解时代背景与世界观。
- 【选中片段】：你真正要提取的目标内容。

你必须严格按照以下 JSON 格式返回，不得包含任何额外文字说明：

{
  "eraSetting": "整个剧本的时代背景设定（必须推断！如：19世纪维多利亚时代英国、中国明朝末年、近未来赛博朋克东京、当代美国中西部等。这是全局性设定，将统一注入所有资产和分镜中，确保视觉风格、建筑、服装、道具、光影等元素与时代高度一致）",
  "characters": [
    {
      "name": "人物姓名（如果是代词如'他/她'，请输出为'主角(他)'）",
      "gender": "性别（强制推断脑补，禁止填未明确/未知，必须写出男或女）",
      "desc": "整体外貌与性格摘要（结合时代背景深度推断）",
      "ageRange": "具体年龄段（如：30-35岁，必须推断，不可填未知）",
      "tags": ["性格/职业标签"],
      "faceDetails": {
        "faceShape": "天生脸型骨相（强制推断脑补，禁止填未明确/未知。如：方正宽大/天生高颧骨。严禁修饰胖瘦）",
        "eyes": "天生眼部轮廓（强制推断脑补。如：细长深邃/圆润双眼皮。严禁修饰情绪）",
        "nose": "天生鼻部结构（强制推断脑补。如：高挺/驼峰/塌鼻梁）",
        "mouth": "天生唇形（强制推断脑补。如：嘴唇偏薄/嘴角微微下垂。严禁写干裂起皮）",
        "eyebrows": "天生眉骨与眉形（强制推断脑补。如：浓密剑眉/细弯柳叶眉。严禁写杂乱）",
        "chin": "天生下颚骨骼（强制推断脑补。如：方下巴/尖锐V型。严禁写胡茬）",
        "skinTone": "天生基础肤色肤质（强制推断脑补。如：冷白皮/橄榄色。严禁写患病状态）",
        "hair": "天生发质发色（强制推断脑补。如：黑发/自来卷/亚麻色直发。严禁写打结油腻）",
        "otherFeatures": "固定的永久面部特征（如：天生的黑痣/陈年旧疤。可选脑补，严禁写临时伤痕）"
      }
    }
  ],
  "appearances": [
    {
      "characterName": "所属角色姓名",
      "versionName": "极简短的形象/身份前缀标签（限10字以内，如：底层敛尸工、晚宴伪装版、重度战损形态）",
      "temporalState": "剧作动态特征与伤痕（专门容纳从 faceDetails 剥离的情境状态，如：因营养不良导致的脸颊凹陷、长期受冻发紫的起皮嘴唇）",
      "silhouette": "几何轮廓与体态痕迹（如：因常年负重呈现的佝偻C型体态、重心偏低、宽大的A字型厚重剪影）",
      "headwear": "头部与面部配饰（如：油腻的鸭舌帽。非强制，若无明确描述则不填）",
      "upperBody": "上半身服装材质与真实磨损（如：打满补丁的粗羊毛马甲，褪色的亚麻衬衫）",
      "lowerBody": "下半身服装材质与真实磨损（如：破旧过宽的羊毛裤，膝盖有重重补丁）",
      "footwear": "鞋靴材质与物理特征（如：沾满泥土、磨损严重的皮革靴子，缺失鞋带）",
      "accessories": "随身小物件、腰带与手部细节（非强制，若无明确描述则不填）",
      "clothingIdentity": "基于着装特征推断的社会阶层与身份暗示",
      "sensoryTranslation": "非视觉感官的视觉映射（强制将气味、温度转换为具象画面，如：口鼻处呼出白色的哈气、领口有油亮发黏的黑垢积炭）",
      "colorScheme": "纯客观色彩分布（如：大面积低饱和灰褐色，胸口有一抹暗红色反光）",
      "frontView": "正面构图与几何分布",
      "backView": "背面构图与表面纹理",
      "sideDetail": "侧面图貌细节"
    }
  ]
}

【选角导演的捏脸铁律】：

1. faceDetails = 出厂默认值：只记录角色天生的骨骼结构与生理底色。
   - ❌ 错误："下颌布满胡茬"（临时状态）→ ✅ 正确："下颌方正且宽大"（骨相）
   - ❌ 错误："眼眶因饥饿深陷"（剧情状态）→ ✅ 正确："天生深邃的窄长眼窝"（骨相）
   - ❌ 错误："未明确描述的鼻形"（逃避推测）→ ✅ 正确："鼻梁高挺微微偏左（旧伤导致的永久骨相偏移）"

2. 强制推理捏脸：即使剧本只写了"一个骑士"，你也必须根据职业、阶层、种族背景，大胆且合理地捏出完整五官。底层劳工→可脑补天生高颧骨、粗眉；贵族商人→可脑补细长眼、高挺鼻。绝对禁止任何字段填"未明确描述"。

3. 剥离的动态状态必须全部装载到 appearances 的 temporalState 中。

【造型指导的着装铁律】：

1. 全角色全覆盖：剧本中每一个有名字或独立描写的角色，都必须至少生成一条 appearance。遗漏任何角色视为严重失败！
2. 多阶段强制拆分：同一角色有两种以上不同着装或状态，必须拆分为多条 appearance。
3. 服装是形象核心：角色穿的所有衣物按部位归入 headwear/upperBody/lowerBody/footwear/accessories，绝不可作为独立道具。
4. 时代校准：所有服装材质、款式、配色必须与 eraSetting 高度一致。19世纪穷人穿粗羊毛不穿涤纶，古代武将穿甲胄不穿防弹衣。
5. 绝对客观白描：禁止大词（赛博朋克感、潇洒帅气）。只允许构图、颜色、材质纹理的客观组合。
6. 非视觉强硬视觉化："寒冷"→"呼出白色哈气"，"恶臭"→"布满发黏的黑色斑块"。严禁出现温度/气味/心理感受的抽象描写。`
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

    console.log(`[API Extract-Highlight] 🎬 类型: ${extractionType}, 文本长度: ${selectedText.length}`)

    const completion = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt(extractionType) },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 8192,
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
      eraSetting: result.eraSetting ? '✓' : '—',
      characters: result.characters?.length ?? 0,
      appearances: result.appearances?.length ?? 0,
      scenes: result.scenes?.length ?? 0,
      props: result.props?.length ?? 0,
    })

    return NextResponse.json({
      extraction_type: extractionType,
      eraSetting: result.eraSetting || '',
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
