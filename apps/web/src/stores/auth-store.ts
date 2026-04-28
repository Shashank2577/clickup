import { create } from 'zustand'
import { api } from '@/lib/api-client'

interface Workspace {
  id: string
  name: string
  logoUrl?: string
  plan: string
}

interface AuthState {
  workspace: Workspace | null
  workspaces: Workspace[]
  loadWorkspaces: () => Promise<void>
  setActiveWorkspace: (workspaceId: string) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  workspace: null,
  workspaces: [],

  loadWorkspaces: async () => {
    const workspaces = await api.get<Workspace[]>('/workspaces/me')
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('clickup_workspace') : null
    const active = workspaces.find(w => w.id === savedId) ?? workspaces[0] ?? null
    set({ workspaces, workspace: active })
  },

  setActiveWorkspace: (workspaceId) => {
    const ws = get().workspaces.find(w => w.id === workspaceId)
    if (ws) {
      if (typeof window !== 'undefined') localStorage.setItem('clickup_workspace', workspaceId)
      set({ workspace: ws })
    }
  },
}))
