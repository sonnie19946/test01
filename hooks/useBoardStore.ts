import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Board {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

interface BoardStore {
  boards: Board[]
  activeBoardId: string

  createBoard: (name?: string) => string
  deleteBoard: (id: string) => void
  renameBoard: (id: string, name: string) => void
  setActiveBoard: (id: string) => void
  touchBoard: (id: string) => void
}

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export const useBoardStore = create<BoardStore>()(
  persist(
    (set, get) => ({
      boards: [
        {
          id: 'demo',
          name: '默认项目',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      activeBoardId: 'demo',

      createBoard: (name) => {
        const id = generateId()
        const board: Board = {
          id,
          name: name || `新项目 ${get().boards.length + 1}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((s) => ({ boards: [...s.boards, board] }))
        return id
      },

      deleteBoard: (id) => {
        set((s) => {
          const remaining = s.boards.filter((b) => b.id !== id)
          // 如果删掉的是当前激活的，切换到第一个
          const activeBoardId =
            s.activeBoardId === id
              ? (remaining[0]?.id ?? 'demo')
              : s.activeBoardId
          // 清理 localStorage 中对应的 flow 数据
          try {
            localStorage.removeItem(`sonnie-flow-${id}`)
          } catch {}
          return { boards: remaining, activeBoardId }
        })
      },

      renameBoard: (id, name) => {
        set((s) => ({
          boards: s.boards.map((b) =>
            b.id === id ? { ...b, name, updatedAt: Date.now() } : b
          ),
        }))
      },

      setActiveBoard: (id) => set({ activeBoardId: id }),

      touchBoard: (id) => {
        set((s) => ({
          boards: s.boards.map((b) =>
            b.id === id ? { ...b, updatedAt: Date.now() } : b
          ),
        }))
      },
    }),
    {
      name: 'sonnie-boards',
      // 初始化时迁移旧数据：sonnie-flow-store -> sonnie-flow-demo
      onRehydrateStorage: () => () => {
        try {
          const oldKey = 'sonnie-flow-store'
          const newKey = 'sonnie-flow-demo'
          const old = localStorage.getItem(oldKey)
          // 只在还没迁移过时执行
          if (old && !localStorage.getItem(newKey)) {
            localStorage.setItem(newKey, old)
            console.log('[BoardStore] 已将旧数据迁移至 sonnie-flow-demo')
          }
        } catch {}
      },
    }
  )
)
