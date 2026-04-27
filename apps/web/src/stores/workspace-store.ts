import { create } from 'zustand'
import { api } from '@/lib/api-client'

interface Space {
  id: string
  name: string
  color: string
  icon?: string
  order: number
  lists: SpaceList[]
}

interface SpaceList {
  id: string
  name: string
  spaceId: string
  folderId?: string
  taskCount: number
  order: number
}

interface Member {
  id: string
  userId: string
  fullName: string
  email: string
  avatarUrl?: string
  initials: string
  role: string
}

interface WorkspaceState {
  spaces: Space[]
  members: Member[]
  favorites: Favorite[]
  isLoading: boolean

  loadSpaces: (workspaceId: string) => Promise<void>
  loadMembers: (workspaceId: string) => Promise<void>
  loadFavorites: (workspaceId: string) => Promise<void>
  addFavorite: (entityType: string, entityId: string) => Promise<void>
  removeFavorite: (favoriteId: string) => Promise<void>
  createSpace: (workspaceId: string, name: string, color: string) => Promise<Space>
  createList: (spaceId: string, name: string) => Promise<SpaceList>
}

interface Favorite {
  id: string
  entityType: string
  entityId: string
  entityName: string
  position: number
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  spaces: [],
  members: [],
  favorites: [],
  isLoading: false,

  loadSpaces: async (workspaceId) => {
    set({ isLoading: true })
    const spaces = await api.get<Space[]>('/spaces', { params: { workspaceId } })
    // Load lists for each space
    const spacesWithLists = await Promise.all(
      spaces.map(async (space) => {
        const lists = await api.get<SpaceList[]>(`/spaces/${space.id}/lists`)
        return { ...space, lists }
      })
    )
    set({ spaces: spacesWithLists, isLoading: false })
  },

  loadMembers: async (workspaceId) => {
    const members = await api.get<Member[]>(`/workspaces/${workspaceId}/members`)
    set({ members })
  },

  loadFavorites: async (workspaceId) => {
    const favorites = await api.get<Favorite[]>('/favorites', { params: { workspaceId } })
    set({ favorites })
  },

  addFavorite: async (entityType, entityId) => {
    const fav = await api.post<Favorite>('/favorites', { body: { entityType, entityId } })
    set({ favorites: [...get().favorites, fav] })
  },

  removeFavorite: async (favoriteId) => {
    await api.delete(`/favorites/${favoriteId}`)
    set({ favorites: get().favorites.filter(f => f.id !== favoriteId) })
  },

  createSpace: async (workspaceId, name, color) => {
    const space = await api.post<Space>('/spaces', { body: { workspaceId, name, color } })
    set({ spaces: [...get().spaces, { ...space, lists: [] }] })
    return space
  },

  createList: async (spaceId, name) => {
    const list = await api.post<SpaceList>('/lists', { body: { spaceId, name } })
    set({
      spaces: get().spaces.map(s =>
        s.id === spaceId ? { ...s, lists: [...s.lists, list] } : s
      ),
    })
    return list
  },
}))
