// Flow canvas constants

// 节点类型到中文标签的映射
export const TYPE_LABELS: Record<string, string> = {
  script: '剧本',
  character: '角色',
  scene: '场景',
  prop: '道具',
  appearance: '角色形象',
  shot: '分镜',
  shot_pool: '分镜池',
  prompt: '提示',
  unknown: '未知',
}

// 节点调色板（用于右键菜单添加节点）
export const PALETTE = [
  { type: 'script',    label: `+ ${TYPE_LABELS.script}`,    color: 'var(--node-script)' },
  { type: 'character', label: `+ ${TYPE_LABELS.character}`, color: 'var(--node-character)' },
  { type: 'scene',     label: `+ ${TYPE_LABELS.scene}`,     color: 'var(--node-scene)' },
  { type: 'prop',      label: `+ ${TYPE_LABELS.prop}`,      color: 'var(--node-prop)' },
  { type: 'appearance', label: `+ ${TYPE_LABELS.appearance}`, color: 'var(--node-appearance)' },
  { type: 'shot',      label: `+ ${TYPE_LABELS.shot}`,      color: 'var(--node-shot)' },
  { type: 'shot_pool', label: `+ ${TYPE_LABELS.shot_pool}`, color: '#10B981' },
]

// 节点类型到十六进制颜色的映射（与 CSS 变量保持一致）
export const COLOR_HEX: Record<string, string> = {
  script: '#D4AF37',
  character: '#8B5CF6',
  appearance: '#14B8A6',
  scene: '#3B82F6',
  prop: '#F97316',
  shot: '#10B981',
  shot_pool: '#10B981',
}

// 连线合法性规则表
export const VALID_TARGETS: Record<string, string[]> = {
  script:    ['character', 'scene', 'prop', 'shot', 'shot_pool'],
  character: ['appearance'],
  appearance: ['shot', 'shot_pool'],
  scene:     ['shot', 'shot_pool'],
  prop:      ['shot', 'shot_pool'],
  shot:      ['prompt'],
  shot_pool: [],
  prompt:    [],
}