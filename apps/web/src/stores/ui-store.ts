import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  sidebarWidth: number
  commandPaletteOpen: boolean
  activeTaskId: string | null

  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  openCommandPalette: () => void
  closeCommandPalette: () => void
  openTaskDetail: (taskId: string) => void
  closeTaskDetail: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  sidebarWidth: 240,
  commandPaletteOpen: false,
  activeTaskId: null,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  openTaskDetail: (taskId) => set({ activeTaskId: taskId }),
  closeTaskDetail: () => set({ activeTaskId: null }),
}))
