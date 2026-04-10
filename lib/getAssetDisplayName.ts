/**
 * 统一资产显示名计算，画布节点和引用面板共享同一逻辑
 */
export function getAssetDisplayName(
  type: string | undefined,
  data: Record<string, any>,
): string {
  if (type === 'appearance') {
    const charName = String(data?.characterName || data?.name || '未命名')
    const version = String(data?.versionName || '')
    if (version && !charName.includes(version)) {
      return `${charName}(${version})`
    }
    return charName
  }
  return String(data?.name || data?.label || data?.characterName || '未命名')
}
