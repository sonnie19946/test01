import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsStore {
  // ── 剧本解析 (Text API) ──
  scriptBaseUrl: string
  scriptApiKey: string
  scriptModel: string

  // ── 图像生成 (Image API) ──
  imageBaseUrl: string
  imageApiKey: string
  imageModel: string

  // ── setters ──
  setScriptBaseUrl: (v: string) => void
  setScriptApiKey: (v: string) => void
  setScriptModel: (v: string) => void
  setImageBaseUrl: (v: string) => void
  setImageApiKey: (v: string) => void
  setImageModel: (v: string) => void

  // ── clear ──
  clearScriptConfig: () => void
  clearImageConfig: () => void
  clearAll: () => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      scriptBaseUrl: '',
      scriptApiKey: '',
      scriptModel: '',

      imageBaseUrl: '',
      imageApiKey: '',
      imageModel: '',

      setScriptBaseUrl: (v) => set({ scriptBaseUrl: v.trim() }),
      setScriptApiKey: (v) => set({ scriptApiKey: v.trim() }),
      setScriptModel: (v) => set({ scriptModel: v.trim() }),
      setImageBaseUrl: (v) => set({ imageBaseUrl: v.trim() }),
      setImageApiKey: (v) => set({ imageApiKey: v.trim() }),
      setImageModel: (v) => set({ imageModel: v.trim() }),

      clearScriptConfig: () => set({ scriptBaseUrl: '', scriptApiKey: '', scriptModel: '' }),
      clearImageConfig: () => set({ imageBaseUrl: '', imageApiKey: '', imageModel: '' }),
      clearAll: () => set({
        scriptBaseUrl: '', scriptApiKey: '', scriptModel: '',
        imageBaseUrl: '', imageApiKey: '', imageModel: '',
      }),
    }),
    { name: 'sonnie-settings' }
  )
)
