'use client'

import { useState, useEffect } from 'react'
import { useFlowStore } from '@/hooks/useFlowStore'
import { toast } from 'sonner'
import { buildPromptFromData } from './AssetDetailForms/PromptBuilder'

// 导入所有切分出来的表单和面板
import { CharacterForm } from './AssetDetailForms/CharacterForm'
import { AppearanceForm } from './AssetDetailForms/AppearanceForm'
import { SceneForm } from './AssetDetailForms/SceneForm'
import { PropForm } from './AssetDetailForms/PropForm'
import { ShotForm } from './AssetDetailForms/ShotForm'
import { PromptForm } from './AssetDetailForms/PromptForm'
import { ImageForm } from './AssetDetailForms/ImageForm'
import { ScriptPanel } from './AssetDetailForms/ScriptPanel'
import { ImageGenerationPanel } from './AssetDetailForms/ImageGenerationPanel'

export function AssetDetailModal() {
  const {
    selectedAssetNode,
    closeAssetModal,
    updateNodeData,
    generateReferenceImage,
    nodes,
  } = useFlowStore()

  const [isLocalGenerating, setIsLocalGenerating] = useState(false)

  // ── 打开时自动继承 eraSetting ──────────────────────────────
  // 旧节点（来自 localStorage）的 eraSetting 可能为空，从画布其他节点继承
  useEffect(() => {
    if (!selectedAssetNode) return
    const currentNodeData = (nodes.find(n => n.id === selectedAssetNode.id) || selectedAssetNode).data as Record<string, any>
    if (currentNodeData?.eraSetting) return  // 已有值，不覆盖

    // 优先找剧本节点，其次找任意有 eraSetting 的节点
    let inherited = ''
    const scriptNode = nodes.find(n => n.type === 'script')
    if (scriptNode) inherited = (scriptNode.data as any)?.eraSetting || ''
    if (!inherited) {
      for (const n of nodes) {
        const era = (n.data as any)?.eraSetting
        if (era && typeof era === 'string' && era.trim()) { inherited = era; break }
      }
    }
    if (inherited) {
      updateNodeData(selectedAssetNode.id, { eraSetting: inherited })
    }
  }, [selectedAssetNode?.id])  // 只在打开（id 变化）时触发

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAssetModal() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [closeAssetModal])

  if (!selectedAssetNode) return null

  const currentNode = nodes.find(n => n.id === selectedAssetNode.id) || selectedAssetNode
  const nodeData = currentNode.data as Record<string, any>
  const nodeType = currentNode.type || 'unknown'
  const imageUrl = nodeData.referenceImage || nodeData.imageUrl
  const isGenerating = nodeData.isGeneratingRef || false
  const isAnyGenerating = isGenerating || isLocalGenerating

  const TYPE_NAME: Record<string, string> = {
    character: '角色', scene: '场景', prop: '道具',
    appearance: '角色形象', shot: '分镜', image: '图像', prompt: '提示词',
  }
  const typeName = TYPE_NAME[nodeType] || '资产'

  const handleCopyPrompt = () => {
    const prompt = buildPromptFromData(nodeData, nodeType)
    navigator.clipboard.writeText(prompt)
      .then(() => toast.success('提示词已复制'))
      .catch(() => toast.error('复制失败'))
  }

  const handleGenerateImage = async () => {
    if (!currentNode) return
    setIsLocalGenerating(true)
    try {
      const prompt = buildPromptFromData(nodeData, nodeType)
      updateNodeData(currentNode.id, { refinedPrompt: prompt })
      await generateReferenceImage(currentNode.id, nodeType, { ...nodeData, refinedPrompt: prompt })
    } catch {
      toast.error('生成失败，请重试')
    } finally {
      setIsLocalGenerating(false)
    }
  }

  const handleDownload = async () => {
    if (!imageUrl) { toast.error('暂无图片可下载'); return }
    try {
      const res = await fetch(imageUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${typeName}-${nodeData.name || nodeData.title || currentNode.id}.png`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('下载已开始')
    } catch {
      window.open(imageUrl, '_blank')
      toast.info('已在新标签页打开，请手动保存')
    }
  }

  // 剧本节点拥有专门的独立全屏面板设计
  if (nodeType === 'script') {
    return <ScriptPanel nodeId={currentNode.id} data={nodeData as any} closeAssetModal={closeAssetModal} nodes={nodes} />
  }

  // 其他资产类型的表单分发渲染
  const renderForm = () => {
    switch (nodeType) {
      case 'character': return <CharacterForm nodeId={currentNode.id} data={nodeData as any} />
      case 'appearance': return <AppearanceForm nodeId={currentNode.id} data={nodeData as any} />
      case 'scene': return <SceneForm nodeId={currentNode.id} data={nodeData as any} />
      case 'prop': return <PropForm nodeId={currentNode.id} data={nodeData as any} />
      case 'shot': return <ShotForm nodeId={currentNode.id} data={nodeData as any} />
      case 'prompt': return <PromptForm nodeId={currentNode.id} data={nodeData as any} />
      case 'image': return <ImageForm nodeId={currentNode.id} data={nodeData as any} />
      default: return <p style={{ fontSize: 13, color: '#9CA3AF' }}>未知节点类型</p>
    }
  }

  return (
    <>
      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.25)',
          backdropFilter: 'blur(4px)',
          zIndex: 50,
        }}
        onPointerDown={e => { if (e.target === e.currentTarget) closeAssetModal() }}
      />

      <div
        onPointerDown={e => { if (e.target === e.currentTarget) closeAssetModal() }}
        style={{
          position: 'fixed', inset: 0, zIndex: 51,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
            width: '100%',
            maxWidth: '1240px',
            maxHeight: '82vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative', 
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 32px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0,
          }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' }}>
              {typeName}详情
            </h2>
            <button
              onClick={closeAssetModal}
              title="关闭 (ESC)"
              style={{
                width: '28px', height: '28px', borderRadius: '6px',
                border: 'none', background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#9CA3AF', transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#374151' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <div style={{
              flex: '0 0 58%',
              padding: '24px 36px 80px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              borderRight: '1px solid #F3F4F6',
            }}>
              <div style={{
                background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px',
                padding: '16px', marginBottom: '8px', fontSize: '13px',
                color: '#4B5563', lineHeight: 1.6, fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                <div style={{ fontWeight: 600, color: '#111827', marginBottom: '8px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  画面推演预览 (Live Prompt)
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {buildPromptFromData(nodeData, nodeType)}
                </div>
              </div>

              {renderForm()}
            </div>

            <ImageGenerationPanel 
              imageUrl={imageUrl} 
              isAnyGenerating={isAnyGenerating} 
              handleCopyPrompt={handleCopyPrompt} 
              handleGenerateImage={handleGenerateImage} 
              handleDownload={handleDownload} 
            />
          </div>
        </div>
      </div>
    </>
  )
}