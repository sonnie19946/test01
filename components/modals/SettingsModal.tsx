'use client'

import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/hooks/useSettingsStore'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

/* ── 单个输入行 ── */
function ConfigInput({
  label,
  placeholder,
  value,
  onChange,
  isSecret,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  isSecret?: boolean
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280' }}>
        {label}
      </label>
      <div style={{
        display: 'flex', alignItems: 'center',
        border: '1px solid #E5E7EB', borderRadius: '8px',
        background: '#F9FAFB', overflow: 'hidden',
        transition: 'border-color 150ms',
      }}>
        <input
          type={isSecret && !visible ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            padding: '8px 12px', fontSize: '12.5px', color: '#1F2937',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        />
        {isSecret && (
          <button
            type="button"
            onClick={() => setVisible(v => !v)}
            title={visible ? '隐藏' : '显示'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0 10px', color: '#9CA3AF', display: 'flex', alignItems: 'center',
            }}
          >
            {visible ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

/* ── 一个功能组区块 ── */
function ConfigSection({
  title,
  icon,
  desc,
  baseUrl,
  apiKey,
  model,
  onBaseUrlChange,
  onApiKeyChange,
  onModelChange,
  onClear,
  placeholders,
}: {
  title: string
  icon: React.ReactNode
  desc: string
  baseUrl: string
  apiKey: string
  model: string
  onBaseUrlChange: (v: string) => void
  onApiKeyChange: (v: string) => void
  onModelChange: (v: string) => void
  onClear: () => void
  placeholders: { url: string; key: string; model: string }
}) {
  const hasAny = baseUrl || apiKey || model
  return (
    <div style={{
      border: '1px solid #E5E7EB', borderRadius: '12px',
      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px',
    }}>
      {/* 标题行 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon}
          <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>{title}</span>
          {hasAny && (
            <span style={{
              fontSize: '10px', fontWeight: 500, color: '#16A34A',
              background: '#F0FDF4', padding: '2px 6px', borderRadius: '4px',
            }}>
              已自定义
            </span>
          )}
        </div>
        {hasAny && (
          <button
            onClick={onClear}
            style={{
              fontSize: '11px', color: '#EF4444', background: 'none',
              border: 'none', cursor: 'pointer', padding: '2px 6px',
              borderRadius: '4px', transition: 'background 120ms',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FEF2F2' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
          >
            清除全部
          </button>
        )}
      </div>

      <p style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: 1.5, margin: 0 }}>
        {desc}
      </p>

      <ConfigInput label="接口地址 (Base URL)" placeholder={placeholders.url} value={baseUrl} onChange={onBaseUrlChange} />
      <ConfigInput label="API 密钥 (API Key)" placeholder={placeholders.key} value={apiKey} onChange={onApiKeyChange} isSecret />
      <ConfigInput label="模型名称 (Model)" placeholder={placeholders.model} value={model} onChange={onModelChange} />
    </div>
  )
}

/* ── Modal 主体 ── */
export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const store = useSettingsStore()

  // ESC 关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* 遮罩 */}
      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.22)',
          backdropFilter: 'blur(4px)',
          zIndex: 60,
        }}
        onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}
      />

      {/* 居中容器 */}
      <div
        onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}
        style={{
          position: 'fixed', inset: 0, zIndex: 61,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div style={{
          background: '#FFFFFF', borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
          width: '100%', maxWidth: '520px', maxHeight: '88vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 28px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0,
          }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>
              API 配置 (BYOK)
            </h2>
            <button
              onClick={onClose}
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
                <path d="M18 6L6 18" /><path d="M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '20px 28px 28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 说明 */}
            <div style={{
              background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '10px',
              padding: '10px 14px', fontSize: '12px', color: '#0369A1', lineHeight: 1.6,
              display: 'flex', gap: '8px', alignItems: 'flex-start',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" /><path d="M12 8h.01" />
              </svg>
              <span>
                配置仅保存在浏览器本地，不会上传服务器。未填写的项将自动回退到系统默认值。
                只需填写你想要覆盖的字段即可。
              </span>
            </div>

            {/* 剧本解析 API 配置 */}
            <ConfigSection
              title="剧本解析 API"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              }
              desc="用于剧本资产提取和分镜拆解。支持任何兼容 OpenAI Chat Completions 格式的接口（DeepSeek、OpenAI、Moonshot 等）。"
              baseUrl={store.scriptBaseUrl}
              apiKey={store.scriptApiKey}
              model={store.scriptModel}
              onBaseUrlChange={store.setScriptBaseUrl}
              onApiKeyChange={store.setScriptApiKey}
              onModelChange={store.setScriptModel}
              onClear={store.clearScriptConfig}
              placeholders={{
                url: '例: https://api.deepseek.com/v1',
                key: 'sk-...',
                model: '例: deepseek-chat',
              }}
            />

            {/* 图像生成 API 配置 */}
            <ConfigSection
              title="图像生成 API"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EC4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              }
              desc="用于角色参考图和分镜图像生成。支持任何兼容 OpenAI Images Generations 格式的接口。"
              baseUrl={store.imageBaseUrl}
              apiKey={store.imageApiKey}
              model={store.imageModel}
              onBaseUrlChange={store.setImageBaseUrl}
              onApiKeyChange={store.setImageApiKey}
              onModelChange={store.setImageModel}
              onClear={store.clearImageConfig}
              placeholders={{
                url: '例: https://api.openai.com',
                key: 'sk-...',
                model: '例: gpt-image-1',
              }}
            />
          </div>
        </div>
      </div>
    </>
  )
}
