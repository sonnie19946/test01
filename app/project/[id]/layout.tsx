// 项目布局：全屏、无滚动、画布容器
export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#050506',
      }}
    >
      {children}
    </div>
  )
}
