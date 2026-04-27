'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Skeleton } from '@/components/motion'
import { wsClient } from '@/lib/websocket'
import { useAuthStore, useWorkspaceStore, useNotificationStore } from '@/stores'

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const { isLoading, isAuthenticated, user, workspace, loadCurrentUser, loadWorkspaces } = useAuthStore()
  const { loadSpaces, loadFavorites } = useWorkspaceStore()
  const { loadNotifications } = useNotificationStore()

  useEffect(() => {
    loadCurrentUser()
  }, [loadCurrentUser])

  useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname !== '/login' && pathname !== '/register') {
      router.replace('/login')
    }
  }, [isLoading, isAuthenticated, pathname, router])

  useEffect(() => {
    async function bootstrap() {
      if (!isAuthenticated || !user) return
      await loadWorkspaces()
    }
    bootstrap()
  }, [isAuthenticated, user, loadWorkspaces])

  useEffect(() => {
    if (!isAuthenticated || !user || !workspace) return

    loadSpaces(workspace.id)
    loadFavorites(workspace.id)
    loadNotifications('primary')

    const token = localStorage.getItem('clickup_token')
    if (token) {
      wsClient.connect(token)
      wsClient.subscribe(`workspace:${workspace.id}`)
      wsClient.subscribe(`user:${user.id}`)
    }

    return () => {
      wsClient.unsubscribe(`workspace:${workspace.id}`)
      wsClient.unsubscribe(`user:${user.id}`)
    }
  }, [isAuthenticated, user, workspace, loadSpaces, loadFavorites, loadNotifications])

  if (isLoading && pathname !== '/login' && pathname !== '/register') {
    return <Skeleton className="h-screen w-screen" />
  }

  return <>{children}</>
}
