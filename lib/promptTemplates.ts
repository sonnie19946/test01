/**
 * 前置提示词模板管理 + 标点审查工具
 * 集中管理各节点类型的提示词模板，支持用户自定义覆盖（localStorage 持久化）
 */

// ── 模板类型定义 ──────────────────────────────────────────────
export interface PromptTemplate {
  /** 提示词开头的核心指令 */
  prefix: string
  /** 提示词末尾的画幅/摄影机限定 */
  suffix: string
  /** 场景/视角额外约束（可选） */
  constraints?: string
}

export type PromptNodeType = 'character' | 'appearance' | 'scene' | 'prop'

// ── 默认模板（从 AssetDetailModal 迁移） ─────────────────────
const DEFAULT_TEMPLATES: Record<PromptNodeType, PromptTemplate> = {
  character: {
    prefix:
      '一个全新的、史诗般的特写照片（Epic close-up cinematic photograph, raw photo, high grain）。',
    constraints:
      '【重要场景约束】：场景必须被纯白底、隔离的干净摄影棚（pure white studio background, strict isolated background）笼罩，人物身后绝对不能出现任何自然风景、建筑或杂物！\n【核心视图约束】：人物必须完全正脸看向镜头（front view, mugshot style），双肩赤裸或仅露出锁骨（bare shoulders, neck and collarbone visible only），没有任何服装的遮挡，以最高清晰度专门展示面部骨相和五官（highly detailed face structure）。',
    suffix:
      '完美的摄影棚蝴蝶光（butterfly lighting），RAW照片，高细节，电影颗粒感，角色原画设定图 --ar 1:1',
  },
  appearance: {
    prefix:
      '一个史诗般的、详细的全身各角度影棚参考照片（character turnaround sheet, front side back view）。\n场景被纯白底、隔离、干净的影棚背景笼罩。光线是柔和、干净、均匀的影棚光，能够完美呈现所有细节，没有harsh暗影。',
    constraints: '',
    suffix:
      '原始照片、高细节、所有纹理清晰、电影颗粒感 --ar 16:9',
  },
  scene: {
    prefix:
      '一个史诗般的、高度详细的影视级环境概念设定图（Cinematic environment concept art）。\n建立镜头（Establishing shot），全景广角视角（Wide-angle perspective）。\n这是一个【绝对无人/无动物的空镜（Empty set, strictly no humans, no animals, no creatures）】，展现纯粹的环境。',
    constraints: '',
    suffix:
      '高细节环境纹理、Octane Render渲染质感、电影颗粒感 --ar 16:9',
  },
  prop: {
    prefix:
      '一个史诗般的、高度详细的电影级道具设定图（Prop concept art）。\n主体完全孤立在纯白背景上（Isolated on pure white background），使用干净的影棚布光，无杂乱投射影。',
    constraints: '',
    suffix:
      '原始照片、高细节、所有纹理清晰、电影颗粒感 --ar 16:9',
  },
}

// ── localStorage 持久化 key ──────────────────────────────────
const STORAGE_KEY = 'sonnie_prompt_templates'

function loadFromStorage(): Record<PromptNodeType, PromptTemplate> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveToStorage(templates: Record<PromptNodeType, PromptTemplate>) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  } catch {}
}

// ── 运行时缓存 ──────────────────────────────────────────────
let runtimeTemplates: Record<PromptNodeType, PromptTemplate> | null = null

function ensureLoaded(): Record<PromptNodeType, PromptTemplate> {
  if (runtimeTemplates) return runtimeTemplates
  const stored = loadFromStorage()
  // 合并：stored 覆盖 DEFAULT，防止用户存储中缺少新增字段
  runtimeTemplates = { ...DEFAULT_TEMPLATES }
  if (stored) {
    for (const key of Object.keys(stored) as PromptNodeType[]) {
      if (DEFAULT_TEMPLATES[key]) {
        runtimeTemplates[key] = { ...DEFAULT_TEMPLATES[key], ...stored[key] }
      }
    }
  }
  return runtimeTemplates
}

// ── 公共 API ─────────────────────────────────────────────────
export function getTemplate(type: PromptNodeType): PromptTemplate {
  return ensureLoaded()[type]
}

export function getAllTemplates(): Record<PromptNodeType, PromptTemplate> {
  return { ...ensureLoaded() }
}

export function setTemplate(type: PromptNodeType, template: PromptTemplate) {
  const all = ensureLoaded()
  all[type] = template
  runtimeTemplates = { ...all }
  saveToStorage(runtimeTemplates)
}

export function setAllTemplates(templates: Record<PromptNodeType, PromptTemplate>) {
  runtimeTemplates = { ...templates }
  saveToStorage(runtimeTemplates)
}

export function resetToDefaults() {
  runtimeTemplates = { ...DEFAULT_TEMPLATES }
  saveToStorage(runtimeTemplates)
}

export function getDefaults(): Record<PromptNodeType, PromptTemplate> {
  return { ...DEFAULT_TEMPLATES }
}

// ── 节点类型标签映射 ─────────────────────────────────────────
export const TEMPLATE_TYPE_LABELS: Record<PromptNodeType, string> = {
  character: '角色',
  appearance: '角色形象',
  scene: '场景',
  prop: '道具',
}

// ── 标点审查 sanitizePromptText ──────────────────────────────
/**
 * 清理 AI 生成 / 手工拼接的提示词，修复标点错乱问题
 * - 去除连续重复标点
 * - 修复矛盾标点组合（如 。，→ ，）
 * - 清理标点前的空格
 * - 去除首尾空白与多余空行
 * - 统一半角/全角逗号句号混用
 */
export function sanitizePromptText(text: string): string {
  if (!text) return ''

  let s = text

  // 1. 首尾修剪
  s = s.trim()

  // 2. 统一半角标点 → 全角（仅中文语境的混用情况）
  //    如果前后都是中文字符，则将半角 , 和 . 转为全角
  s = s.replace(/([\u4e00-\u9fff])\.(?=[\u4e00-\u9fff])/g, '$1。')
  s = s.replace(/([\u4e00-\u9fff]),(?=[\u4e00-\u9fff])/g, '$1，')

  // 3. 清理标点前的空白：` ，` → `，`  ` 。` → `。`
  s = s.replace(/\s+([，。、；：！？）」』】）])/g, '$1')

  // 4. 修复矛盾标点对
  s = s.replace(/。，/g, '，')
  s = s.replace(/，。/g, '。')
  s = s.replace(/。、/g, '、')
  s = s.replace(/、。/g, '。')

  // 5. 去除连续重复标点
  s = s.replace(/([，。、；：！？])\1+/g, '$1')

  // 6. 修复标点后直接跟另一个标点（同类降重）
  s = s.replace(/，{2,}/g, '，')
  s = s.replace(/。{2,}/g, '。')

  // 7. 修复 `。。` `，，` 类残余 (belt-and-braces)
  s = s.replace(/([。，、；：！？])\s*\1/g, '$1')

  // 8. 清理多余空行（保留最多一个空行）
  s = s.replace(/\n{3,}/g, '\n\n')

  // 9. 去除段落首尾的孤立标点
  s = s.replace(/^[，。、；：]+/gm, '')
  s = s.replace(/\n[，。、；：]+$/gm, '')

  // 10. 最终修剪
  s = s.trim()

  return s
}
