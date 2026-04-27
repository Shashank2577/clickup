import { create } from 'zustand'
import { api } from '@/lib/api-client'

interface User {
  id: string
  fullName: string
  email: string
  avatarUrl?: string
  initials: string
}

interface Workspace {
  id: string
  name: string
  logoUrl?: string
  plan: string
}

interface AuthState {
  user: User | null
  workspace: Workspace | null
  workspaces: Workspace[]
  isAuthenticated: boolean
  isLoading: boolean

  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  loadCurrentUser: () => Promise<void>
  loadWorkspaces: () => Promise<void>
  setActiveWorkspace: (workspaceId: string) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  workspace: null,
  workspaces: [],
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const data = await api.post<{ token: string; user: { id: string; name: string; email: string; avatar_url?: string } }>('/auth/login', {
      body: { email, password },
    })
    api.setToken(data.token)
    const nameParts = data.user.name.split(' ')
    const user: User = {
      id: data.user.id,
      fullName: data.user.name,
      email: data.user.email,
      avatarUrl: data.user.avatar_url,
      initials: nameParts.map(p => p[0]).join('').toUpperCase().slice(0, 2),
    }
    set({ user, isAuthenticated: true })
    await get().loadWorkspaces()
  },

  logout: async () => {
    try { await api.post('/auth/logout') } catch {}
    api.clearToken()
    set({ user: null, workspace: null, workspaces: [], isAuthenticated: false })
  },

  loadCurrentUser: async () => {
    try {
      const raw = await api.get<{ id: string; name: string; email: string; avatar_url?: string }>('/users/me')
      const nameParts = raw.name.split(' ')
      const user: User = {
        id: raw.id,
        fullName: raw.name,
        email: raw.email,
        avatarUrl: raw.avatar_url,
        initials: nameParts.map(p => p[0]).join('').toUpperCase().slice(0, 2),
      }
      set({ user, isAuthenticated: true, isLoading: false })
    } catch {
      set({ isAuthenticated: false, isLoading: false })
    }
  },

  loadWorkspaces: async () => {
    const workspaces = await api.get<Workspace[]>('/workspaces/me')
    const savedId = localStorage.getItem('clickup_workspace')
    const active = workspaces.find(w => w.id === savedId) ?? workspaces[0] ?? null
    set({ workspaces, workspace: active })
  },

  setActiveWorkspace: (workspaceId) => {
    const ws = get().workspaces.find(w => w.id === workspaceId)
    if (ws) {
      localStorage.setItem('clickup_workspace', workspaceId)
      set({ workspace: ws })
    }
  },
}))
