'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useUser, useSession } from '@clerk/nextjs'
import { Skeleton } from '@/components/motion'
import { wsClient } from '@/lib/websocket'
import { useAuthStore, useWorkspaceStore, useNotificationStore } from '@/stores'
import { api } from '@/lib/api-client'

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const { isLoaded, isSignedIn, user } = useUser()
  const { session } = useSession()
  const { loadWorkspaces, workspace } = useAuthStore()
  const { loadSpaces, loadFavorites } = useWorkspaceStore()
  const { loadNotifications } = useNotificationStore()

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn && pathname !== '/login' && pathname !== '/register') {
      router.replace('/login')
    }
  }, [isLoaded, isSignedIn, pathname, router])

  // Sync user to DB then load workspaces on sign-in
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return
    const email = user.primaryEmailAddress?.emailAddress ?? ''
    const name = user.fullName ?? email
    api.post('/auth/sync', { body: { email, name } })
      .catch(() => {})
      .finally(() => loadWorkspaces())
  }, [isLoaded, isSignedIn, user, loadWorkspaces])

  // Load workspace data + WebSocket once workspace is resolved
  useEffect(() => {
    if (!workspace || !session) return
    loadSpaces(workspace.id)
    loadFavorites(workspace.id)
    loadNotifications('primary')

    session.getToken().then((token) => {
      wsClient.connect(token ?? '')
      wsClient.subscribe(`workspace:${workspace.id}`)
      wsClient.subscribe(`user:${user?.id ?? ''}`)
    })

    return () => {
      wsClient.unsubscribe(`workspace:${workspace.id}`)
      wsClient.unsubscribe(`user:${user?.id ?? ''}`)
    }
  }, [workspace, session, loadSpaces, loadFavorites, loadNotifications, user?.id])

  if (!isLoaded && pathname !== '/login' && pathname !== '/register') {
    return <Skeleton className="h-screen w-screen" />
  }

  return <>{children}</>
}
