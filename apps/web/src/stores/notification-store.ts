import { create } from 'zustand'
import { api } from '@/lib/api-client'

interface Notification {
  id: string
  type: 'task-assigned' | 'comment' | 'mention' | 'status-change' | 'due-date' | 'subtask'
  title: string
  description: string
  spaceName: string
  authorName: string
  authorInitials: string
  authorColor: string
  isRead: boolean
  category: 'primary' | 'other'
  createdAt: string
  snoozedUntil?: string
  clearedAt?: string
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  activeTab: 'primary' | 'other' | 'later' | 'cleared'
  isLoading: boolean

  loadNotifications: (tab?: string) => Promise<void>
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  snooze: (notificationId: string, until: string) => Promise<void>
  clear: (notificationId: string) => Promise<void>
  clearAll: () => Promise<void>
  setActiveTab: (tab: 'primary' | 'other' | 'later' | 'cleared') => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  activeTab: 'primary',
  isLoading: false,

  loadNotifications: async (tab) => {
    set({ isLoading: true })
    const activeTab = tab ?? get().activeTab
    const notifications = await api.get<Notification[]>('/notifications', {
      params: { tab: activeTab },
    })
    const unreadCount = notifications.filter(n => !n.isRead).length
    set({ notifications, unreadCount, isLoading: false })
  },

  markAsRead: async (notificationId) => {
    await api.patch(`/notifications/${notificationId}/read`)
    set({
      notifications: get().notifications.map(n =>
        n.id === notificationId ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, get().unreadCount - 1),
    })
  },

  markAllAsRead: async () => {
    await api.post('/notifications/read-all')
    set({
      notifications: get().notifications.map(n => ({ ...n, isRead: true })),
      unreadCount: 0,
    })
  },

  snooze: async (notificationId, until) => {
    await api.patch(`/notifications/${notificationId}/snooze`, { body: { snoozeUntil: until } })
    set({
      notifications: get().notifications.filter(n => n.id !== notificationId),
    })
  },

  clear: async (notificationId) => {
    await api.patch(`/notifications/${notificationId}/clear`)
    set({
      notifications: get().notifications.filter(n => n.id !== notificationId),
    })
  },

  clearAll: async () => {
    await api.post('/notifications/clear-all')
    set({ notifications: [] })
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab })
    get().loadNotifications(tab)
  },
}))
