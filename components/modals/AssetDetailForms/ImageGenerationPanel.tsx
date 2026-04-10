import React from 'react'

export function ActionButton({
  onClick, icon, label, disabled, loading, primary,
}: {
  onClick: () => void
  icon: React.ReactNode
  label: string
  disabled?: boolean
  loading?: boolean
  primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '8px 16px',
        borderRadius: '8px',
        border: primary ? 'none' : '1px solid #E5E7EB',
        background: primary ? '#4F6DC8' : '#FFFFFF',
        color: primary ? '#FFFFFF' : '#374151',
        fontSize: '13px', fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.15s',
        fontFamily: 'inherit',
      }}
      onMouseEnter={e => {
        if (disabled) return
        ;(e.currentTarget as HTMLElement).style.background = primary ? '#3D5AB5' : '#F9FAFB'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.background = primary ? '#4F6DC8' : '#FFFFFF'
      }}
    >
      {loading ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
          <path d="M4 12a8 8 0 0 1 8-8" strokeLinecap="round"/>
        </svg>
      ) : icon}
      {label}
    </button>
  )
}

export function ImageGenerationPanel({
  imageUrl,
  isAnyGenerating,
  handleCopyPrompt,
  handleGenerateImage,
  handleDownload,
}: {
  imageUrl: string
  isAnyGenerating: boolean
  handleCopyPrompt: () => void
  handleGenerateImage: () => void
  handleDownload: () => void
}) {
  return (
    <>
      <div style={{
        flex: 1,
        padding: '32px 28px 80px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: '12px',
          background: '#F9FAFB',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="参考图像"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '8px',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <path d="m21 15-5-5L5 21"/>
              </svg>
              <p style={{ fontSize: '12px', color: '#D1D5DB', margin: 0, textAlign: 'center' }}>
                暂无参考图像
              </p>
            </div>
          )}
        </div>
      </div>

      <div style={{
        position: 'absolute',
        bottom: '22px',
        right: '28px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        zIndex: 10,
      }}>
        <ActionButton
          onClick={handleCopyPrompt}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          }
          label="复制提示词"
        />
        <ActionButton
          onClick={handleGenerateImage}
          disabled={isAnyGenerating}
          loading={isAnyGenerating}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M8 16H3v5"/>
            </svg>
          }
          label={isAnyGenerating ? '生成中…' : imageUrl ? '重新生成' : '生成图片'}
        />
        <ActionButton
          onClick={handleDownload}
          disabled={!imageUrl}
          primary
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7,10 12,15 17,10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          }
          label="下载原图"
        />
      </div>
    </>
  )
}
